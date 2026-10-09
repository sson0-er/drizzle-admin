import { createServer } from "node:https";
import type { AddressInfo } from "node:net";
import Provider from "oidc-provider";

export interface MockIdpOptions {
  key: string;
  cert: string;
  /** 0 picks a free port (tests). */
  port: number;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
}

export interface MockIdp {
  issuer: string;
  close(): Promise<void>;
}

/**
 * Starts a local OIDC provider on 127.0.0.1. Loopback only: devInteractions lets anyone sign in
 * as any user name, so the app's allowlist decides who gets in.
 */
export async function startMockIdp(opts: MockIdpOptions): Promise<MockIdp> {
  // Listen first so the issuer can carry the real port; the handler is set once the provider exists.
  let handler: (typeof Provider.prototype)["callback"] extends () => infer H ? H : never;
  const server = createServer({ key: opts.key, cert: opts.cert }, (req, res) => handler(req, res));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, "127.0.0.1", resolve);
  });
  const issuer = `https://localhost:${(server.address() as AddressInfo).port}`;

  const provider = new Provider(issuer, {
    clients: [
      {
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        redirect_uris: opts.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
    ],
    scopes: ["openid", "email", "offline_access"],
    claims: { openid: ["sub"], email: ["email", "email_verified"] },
    findAccount: (_ctx, id) => ({
      accountId: id,
      claims: () => ({ sub: id, email: `${id}@example.test`, email_verified: true }),
    }),
    // Without these the session has no refresh token and the email claims stay out of the ID token.
    issueRefreshToken: () => true,
    conformIdTokenClaims: false,
    features: { devInteractions: { enabled: true }, revocation: { enabled: true } },
  });
  handler = provider.callback();

  return {
    issuer,
    close: () =>
      new Promise<void>((resolve, reject) => {
        // Keep-alive connections from fetch would otherwise delay close().
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
