import {LoaderFunction, redirect} from "remix";
import {handleRedirect} from "../../auth/auth0.server";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    return await handleRedirect(request);
  } catch (e: unknown) {
    const error: Error = e as Error;
    return new Response(error.message || error.toString(), { status: 500 });
  }
}