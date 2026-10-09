import {
  getAuth,
  initOidcAuthMiddleware,
  type OidcAuth,
  type OidcAuthEnv,
  type OidcClaimsHook,
  oidcAuthMiddleware,
  processOAuthCallback,
  revokeSession,
} from "@hono/oidc-auth";
import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import type { Admin, AdminUser } from "../../src/index.js";
import { createExampleAdmin } from "../app.js";
import { type Allowlist, isAllowed, type OidcIdentity } from "./allowlist.js";
import { safeReturnPath } from "./return-path.js";

// The library's default claims hook plus `email_verified`, which follows whichever email is kept.
const claimsHook: OidcClaimsHook = async (orig, claims) => {
  // IDToken claims are untyped JSON; a non-string email counts as absent.
  const email = typeof claims?.email === "string" ? claims.email : "";
  return {
    sub: claims?.sub || orig?.sub || "",
    email: email || orig?.email || "",
    email_verified: email ? claims?.email_verified === true : orig?.email_verified === true,
  };
};

/** `sub` is optional in the library's type; a session without one is treated as signed out. */
function identityOf(auth: OidcAuth | null): OidcIdentity | null {
  if (auth === null || typeof auth.sub !== "string" || auth.sub === "") return null;
  return {
    sub: auth.sub,
    email: typeof auth.email === "string" ? auth.email : "",
    emailVerified: auth.email_verified === true,
  };
}

const adminUserOf = (id: OidcIdentity): AdminUser => ({ id: id.sub, name: id.email || id.sub });

const SignOutForm = () => (
  <form method="post" action="/oidc/logout">
    <button type="submit">Sign out</button>
  </form>
);

const Page = ({ children }: { children: unknown }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>drizzle-admin OIDC demo</title>
    </head>
    <body>{children}</body>
  </html>
);

const AccessDeniedPage = ({ name }: { name: string }) => (
  <Page>
    <h1>Access denied</h1>
    <p>{name} is not allowed to use this admin.</p>
    <p>
      Ask an administrator to add your account to OIDC_ALLOWED_SUBJECTS or
      OIDC_ALLOWED_EMAIL_DOMAINS, or sign in with another account.
    </p>
    <SignOutForm />
  </Page>
);

const SignInFailedPage = () => (
  <Page>
    <h1>Sign-in failed</h1>
    <p>The sign-in could not be completed.</p>
    <a href="/admin/">Try again</a>
  </Page>
);

const FLOW_COOKIES = ["state", "nonce", "code_verifier", "continue"];

export async function createOidcExampleApp(opts: {
  secret: string;
  oidc: Required<OidcAuthEnv>;
  allow: Allowlist;
}): Promise<{ app: Hono; admin: Admin }> {
  // The admin's getUser receives the same Request object the bridge saw (the mount below keeps it).
  const users = new WeakMap<Request, AdminUser>();
  const admin = await createExampleAdmin({
    secret: opts.secret,
    auth: { getUser: async (req) => users.get(req) ?? null, loginUrl: "/oidc/login" },
  });

  const app = new Hono();
  // Configures the library per request; every key is given, so process.env is never consulted.
  app.use("*", initOidcAuthMiddleware(opts.oidc));
  app.use("*", (c, next) => {
    c.set("oidcClaimsHook", claimsHook);
    return next();
  });

  // Must be registered before the mount so that it runs first.
  app.use("/admin/*", async (c, next) => {
    const id = identityOf(await getAuth(c));
    if (id === null) return next();
    if (!isAllowed(id, opts.allow)) {
      return c.html(<AccessDeniedPage name={id.email || id.sub} />, 403);
    }
    users.set(c.req.raw, adminUserOf(id));
    return next();
  });
  app.route("/admin", admin.app);

  app.get("/oidc/login", oidcAuthMiddleware(), async (c) => {
    // After the middleware a session always exists here.
    const id = identityOf(await getAuth(c))!;
    if (!isAllowed(id, opts.allow)) {
      return c.html(<AccessDeniedPage name={id.email || id.sub} />, 403);
    }
    return c.redirect(safeReturnPath(c.req.query("next"), "/admin"), 302);
  });

  app.get("/oidc/callback", async (c) => {
    try {
      return await processOAuthCallback(c);
    } catch (error) {
      // The library's error message can carry the IdP's error text, so only the name is logged.
      for (const name of FLOW_COOKIES) {
        deleteCookie(c, name, { path: "/oidc/callback", secure: true });
      }
      console.error(
        "drizzle-admin OIDC example: sign-in callback failed:",
        error instanceof Error ? error.name : "unknown error",
      );
      return c.html(<SignInFailedPage />, 400);
    }
  });

  app.post("/oidc/logout", csrf(), async (c) => {
    await revokeSession(c);
    return c.redirect("/", 303);
  });

  app.get("/", async (c) => {
    const id = identityOf(await getAuth(c));
    return c.html(
      <Page>
        {id === null ? (
          <a href="/admin/">Sign in</a>
        ) : (
          <>
            <p>Signed in as {id.email || id.sub}</p>
            <a href="/admin/">Open the admin</a>
            <SignOutForm />
          </>
        )}
      </Page>,
    );
  });

  return { app, admin };
}
