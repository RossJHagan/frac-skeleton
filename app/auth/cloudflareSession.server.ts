import {
  createCookie,
  createCloudflareKVSessionStorage
} from "remix";

/**
 * Credit to the Remix docs for this section:
 * https://remix.run/docs/en/v1/api/remix#createcloudflarekvsessionstorage-cloudflare-workers
 */
let sessionCookie = createCookie("__session", {
  secrets: [SESSION_SECRET],
  sameSite: true,
});

let { getSession, commitSession, destroySession } =
  createCloudflareKVSessionStorage({
    kv: AUTH_STORE,
    cookie: sessionCookie
  });

export { getSession, commitSession, destroySession };