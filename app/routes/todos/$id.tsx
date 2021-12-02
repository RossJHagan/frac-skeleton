import {LoaderFunction, json, useLoaderData, redirect} from "remix";
import faunadb, {Collection, Get, Ref} from "faunadb";
import {authorize} from "../../auth/auth0.server";

export const loader: LoaderFunction = async ({ params, request }) => {
  const authorizeResult = await authorize(request);
  if (!authorizeResult.authorized) {
    throw redirect(authorizeResult.redirectUrl);
  }
  if (!authorizeResult.tokens.accessToken) {
    throw redirect('/');
  }

  const todoId = params.id;

  const faunaClient = new faunadb.Client({
    domain: FAUNA_DB_DOMAIN,
    secret: authorizeResult.tokens.accessToken,
  });

  try {
    const result = await faunaClient.query<{ data: { todo: string; owner: string } }>(
      Get(Ref(Collection("Todos"), todoId))
    );
    return json(result.data);
  } catch (e) {
    throw redirect('/');
  }
}

export default function Todo() {
  const todoItem = useLoaderData();
  return (<div>
    Your todo is:
    <pre>{todoItem.todo}</pre>
  </div>)
}
