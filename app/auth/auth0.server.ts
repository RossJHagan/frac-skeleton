import {commitSession, getSession} from "./cloudflareSession.server";
import {redirect} from "remix";

/**
 * Credit to: https://developers.cloudflare.com/workers/tutorials/authorize-users-with-auth0 for almost all of
 * the code with small modifications to use a Remix request instead of the events found in cloudflare native code
 */

const auth0 = {
  domain: AUTH0_DOMAIN,
  clientId: AUTH0_CLIENT_ID,
  clientSecret: AUTH0_CLIENT_SECRET,
  callbackUrl: AUTH0_CALLBACK_URL,
  audience: AUTH0_FAUNA_AUDIENCE,
}

const SESSION_AUTH_KEY = "auth";

function redirectUrl(state: string): string {
  const redirectUrlParams = {
    audience: auth0.audience,
    response_type: "code",
    client_id: auth0.clientId,
    redirect_uri: auth0.callbackUrl,
    scope: "openid%20profile%20email",
    state: encodeURIComponent(state),
  }

  const queryString = Object.entries(redirectUrlParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return `${auth0.domain}/authorize?${queryString}`;
}

async function generateStateParam() {
  const resp = await fetch("https://csprng.xyz/v1/api");
  const { Data: state } = await resp.json();
  await AUTH_STORE.put(`state-${state}`, JSON.stringify(true), { expirationTtl: 86400 });
  return state;
}

interface AuthorizationTokens {
  accessToken: string;
  idToken: string;
  userInfo: Record<string, any>;
}

async function verify(request: Request): Promise<[boolean, AuthorizationTokens?]> {
  const userSession = await getSession(request.headers.get('Cookie'))

  let kvStored = userSession.get(SESSION_AUTH_KEY);
  if (!kvStored) {
    return [false,];
  }
  kvStored = JSON.parse(kvStored);

  const { access_token: accessToken, id_token: idToken } = kvStored
  const userInfo = JSON.parse(decodeJWT(idToken));
  return [true, { accessToken, idToken, userInfo }];
}

interface AuthorizeResultSuccess {
  authorized: true;
  tokens: AuthorizationTokens;
}

interface AuthorizeResultFailure {
  authorized: false;
  redirectUrl: string;
}

export async function authorize(request: Request):
  Promise<AuthorizeResultFailure | AuthorizeResultSuccess>
{
  const [isVerified, authorizationTokens] = await verify(request);
  if (!isVerified || !authorizationTokens ) {
    const state = await generateStateParam();
    return { authorized: false, redirectUrl: redirectUrl(state) };
  }
  return { authorized: true, tokens: authorizationTokens };
}

export async function handleRedirect(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  if (!state) {
    return null;
  }

  const storedState = await AUTH_STORE.get(`state-${state}`);
  if (!storedState) {
    return null;
  }

  const code = url.searchParams.get("code");
  if (code) {
    return exchangeCode(code);
  }
  return {};
}

async function exchangeCode(code: string) {
  const body = JSON.stringify({
    grant_type: "authorization_code",
    client_id: auth0.clientId,
    client_secret: auth0.clientSecret,
    code,
    redirect_uri: auth0.callbackUrl,
    audience: AUTH0_FAUNA_AUDIENCE,
  });

  return persistAuth(
    await fetch(AUTH0_DOMAIN + "/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body
      }
    )
  );

}

function decodeJWT(token: string) {
  var output = token
    .split(".")[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/")
  switch (output.length % 4) {
    case 0:
      break
    case 2:
      output += "=="
      break
    case 3:
      output += "="
      break
    default:
      throw "Illegal base64url string!"
  }

  const result = atob(output)

  try {
    return decodeURIComponent(escape(result))
  } catch (err) {
    console.log(err)
    return result
  }
}

function validateToken(token: { iss: string; aud: string, iat: number, exp: number }) {
  try {
    const dateInSecs = (d: Date) => Math.ceil(Number(d) / 1000)
    const date = new Date()

    let iss = token.iss

    // ISS can include a trailing slash but should otherwise be identical to
    // the AUTH0_DOMAIN, so we should remove the trailing slash if it exists
    iss = iss.endsWith("/") ? iss.slice(0, -1) : iss

    if (iss !== AUTH0_DOMAIN) {
      throw new Error(
        `Token iss value (${iss}) doesn’t match AUTH0_DOMAIN (${AUTH0_DOMAIN})`,
      )
    }

    if (token.aud !== AUTH0_CLIENT_ID) {
      throw new Error(
        `Token aud value (${token.aud}) doesn’t match AUTH0_CLIENT_ID`,
      )
    }

    if (token.exp < dateInSecs(date)) {
      throw new Error(`Token exp value is before current time`)
    }

    // Token should have been issued within the last day
    date.setDate(date.getDate() - 1)
    if (token.iat < dateInSecs(date)) {
      throw new Error(`Token was issued before one day ago and is now invalid`)
    }

    return true;
  } catch (err) {
    console.log((err as Error).message);
    return false;
  }
}

async function persistAuth(exchange: any) {
  const body = await exchange.json();

  if (body.error) {
    throw new Error(body.error);
  }

  const decoded = JSON.parse(decodeJWT(body.id_token));
  const validToken = validateToken(decoded);
  if (!validToken) {
    return new Response(null, { status: 401 });
  }

  // getSession creates a session if one doesn't exist
  const session = await getSession();
  session.set(SESSION_AUTH_KEY, JSON.stringify(body));

  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session, {
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
        httpOnly: true,
      }),
    }
  });
}