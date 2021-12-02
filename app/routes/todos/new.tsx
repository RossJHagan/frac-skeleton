import faunadb, {Collection, Create, CurrentIdentity} from 'faunadb';
import {ActionFunction, Form, LoaderFunction, redirect} from 'remix';
import {authorize} from "../../auth/auth0.server";

export const loader: LoaderFunction = async ({request}) => {
  const authorizeResult = await authorize(request);
  if (!authorizeResult.authorized) {
    throw redirect(authorizeResult.redirectUrl);
  }
  return null;
}

export const action: ActionFunction = async ({ request }) => {
  const authorizeResult = await authorize(request);
  if (!authorizeResult.authorized) {
    throw redirect(authorizeResult.redirectUrl);
  }
  let formData = await request.formData();
  let todo = formData.get("todo")

  try {
    const owner = authorizeResult.tokens?.idToken?.sub;

    if (!owner || !authorizeResult.tokens.accessToken) {
      return redirect('/');
    }

    const faunaClient = new faunadb.Client({
      domain: FAUNA_DB_DOMAIN,
      secret: authorizeResult.tokens.accessToken,
    });

    const result = await faunaClient.query<{ ref: { id: string } }>(
      Create(
        Collection("Todos"),
        {
          data: {
            todo: todo,
            owner: CurrentIdentity(), // CurrentIdentity uses the 'sub' value from the active token
          }
        }
      )
    )

    return redirect(`/todos/${result.ref.id}`);
  } catch (e) {
    console.error(e);
  }
}

export default function TodosNew() {
  return (
    <main>
      <h1>New Todo</h1>
      <Form method="post">
        <div className="flex flex-col bg-gray-100">
          <label className="block font-bold py-2" htmlFor="todo">Todo</label>
          <input type="text"
                 name="todo"
                 id="todo"
                 className="border-2 border-black py-2"/>
          <button className="bg-black text-white font-bold p-4 mt-2">Save Todo item</button>
        </div>
      </Form>
    </main>
  )
}