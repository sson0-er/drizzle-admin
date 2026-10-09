export type OidcMode = "mock" | "real";

// The one place that names the variable (the guard test counts it), so the check and its
// message cannot drift apart.
const VERIFICATION_SWITCH = "NODE_TLS_REJECT_UNAUTHORIZED";

/** Real mode when an issuer is configured, otherwise the local mock IdP. */
export function selectMode(env: Record<string, string | undefined>): OidcMode {
  return env.OIDC_ISSUER ? "real" : "mock";
}

/** Refuses to run when the environment turns certificate verification off (decision 053 point 2). */
export function assertTlsVerificationOn(env: Record<string, string | undefined>): void {
  // "0" is the only value with which Node disables verification.
  if (env[VERIFICATION_SWITCH] === "0") {
    throw new Error(
      `${VERIFICATION_SWITCH}=0 disables TLS certificate verification; unset it to run this example.`,
    );
  }
}
