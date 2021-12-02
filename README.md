# FRAC Skeleton

A skeleton example for building an application on the stack:

- [FaunaDB](https://fauna.com/)
- [Remix.run](https://remix.run/)
- [Auth0](https://auth0.com/)
- [Cloudflare Workers](https://workers.cloudflare.com/)

I hope the docs and code will offer some useful starter patterns to get:

- User authentication with Auth0
- Fauna documents (FQL based) with read permission determined based off the auth0 JWT's `sub`
- Remix session backed by Cloudflare KV Store holding tokens with a secure session cookie on the client

## What it's not

- Deep security, use at your own risk and make sure you understand what's happening.
- Great *authorisation*, only going so far as making sure a fauna document can be read by the user who created it.
- Best practices, a completely new stack to the author, except auth0 in part, so your mileage will vary
- Guaranteed complete, do take a look at the references below to fill gaps.
- Offering logout - just haven't implemented it yet!

## Setup

### Where you should already be

We're not going to go completely from scratch, so here's roughly where you should already be:

- Have nodejs 16.7.0 or higher for the cloudflare worker dev environment
- Have a faunadb account, database and a collection (called "Todos" if you want to use this app's code)
- Have an auth0 account and tenant
- Cloudflare account and the wrangler cli installed

### Environment variables

Cloudflare workers use environment variables without `process.env`, so just `YOUR_BEAUTIFUL_ENV_VAR`.
Don't be too surprised if your IDE is shouting about these and the KV Store's name (`AUTH_STORE`).

The `.env` file is read in automatically by `miniflare` the local cloudflare worker environment, but you'll probably need to use the `wrangler` cli to define your environment variables for a real deployment.

The `.env.template` file is worth having a read through as the shortest version of what you need that I could muster.

Read it? Fab, now copy it to a new `.env` file and keep filling it in as we go.

### KV Store for session

We use KV store to keep the auth tokens (access, identity) out of the client.

Create a KV store using the wrangler cli:

```shell
wrangler kv:namespace create "AUTH_STORE"
```

You can call it anything, `AUTH_STORE` is just how it's named in this codebase.  So if you need to rename it then remember to rename throughout the code too!

### Connecting Auth0 to your application

You should have created an 'Application', this project used the regular web application aiming for the auth code grant flow.

This new application will give you some of the values to complete the `.env` file.

The application configuration should have your 'allowed callback url' set up (likely to be http://127.0.0.1:8787 if you haven't changed any defaults).

### Connecting Auth0's JWT to FaunaDB resources

You'll need a database, a "Todos" collection, and to create an `Access Provider` in that database under `security` > `providers`.

The Issuer in your provider should look like:  

`https://<your tenant>.auth0.com/` - including the final `/`, it matters!  

The JWKS endpoint should look like:

`https://<your tenant>.auth0.com/.well-known/jwks.json`

Double check your configuration from Auth0 by looking in the `endpoints` tab of your auth0 application's advanced settings.

### Making the JWT the source of ownership for a fauna document

Do take a look at the [auth0 fauna guide](https://auth0.com/blog/what-is-fauna-and-how-does-it-work-with-auth0/) where this is mostly sourced from.

You'll need a new role, with create, read permissions on your Collection.  (Write may not be necessary just yet, and we're not adding any write authorisation as part of this!)

This role can be created in your fauna dashboard in the database's `security` > `roles`.  I've called the role "User".

In the new role's `read` custom code add:
```shell
Lambda(
  "ref",
  Equals(CurrentIdentity(), Select(["data", "owner"], Get(Var("ref"))))
)
```
With this, we're ensuring the `CurrentIdentity` (that is the `sub` value off your JWT) is equal to the owner for a succesful read.

### Why a patch package on Remix?

We've used a patch-package to accommodate a small issue with redirects that made the cloudflare worker local development environment unhappy for this version of Remix.  It's been actively worked on, and may even be fixed already.


## Getting started developing

We've added tailwindcss via PostCSS so you'll need to `npm run css:watch` in a terminal to get live style updates, but
don't take this as an exemplary implementation.  It will compile styles out of the `./styles` folder into
the `app/styles`, which is in turn picked up by remix when it changes.

The section below is what comes out of the box with remix's new application:

### Development

You will be running two processes during development.

- Your Miniflare server in one (miniflare is a local environment for Cloudflare Workers)
- The Remix development server in another

```sh
# in one tab (starts remix dev server)
$ npm run dev

# in another (starts miniflare server)
$ npm start
```

Open up [http://127.0.0.1:8787](http://127.0.0.1:8787) and you should be ready to go!

### Deployment

Use wrangler to build and deploy your application to Cloudflare Workers:

```sh
npm run deploy
```


## References


[Remix Cloudflare Workers Docs](https://remix.run/docs/en/v1/api/remix#createcloudflarekvsessionstorage-cloudflare-workers)  
[Remix Jokes App Tutorial - Authentication](https://remix.run/docs/en/v1/tutorials/jokes#authentication)  

[Cloudflare's Auth0 Integration Guide](https://developers.cloudflare.com/workers/tutorials/authorize-users-with-auth0)

[Fauna's Auth0 Guide](https://fauna.com/blog/setting-up-sso-authentication-in-fauna-with-auth0)  
[Auth0's Lighter Version of Fauna's Auth0 Guide](https://auth0.com/blog/what-is-fauna-and-how-does-it-work-with-auth0/#How-Does-the-Fauna-Integration-Work-)
