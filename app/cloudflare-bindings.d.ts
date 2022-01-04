export {};
declare global {
    const FAUNA_DB_DOMAIN: string;

    const AUTH0_DOMAIN: string;
    const AUTH0_CLIENT_ID: string;
    const AUTH0_CLIENT_SECRET: string;

    const AUTH0_CALLBACK_URL: string;
    const AUTH0_FAUNA_AUDIENCE: string;

    const SESSION_SECRET: string;

    const AUTH_STORE: KVNamespace;
}
