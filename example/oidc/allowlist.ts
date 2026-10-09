export interface Allowlist {
  subjects: string[];
  emailDomains: string[];
}

export interface OidcIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

/** Parses the comma-separated environment values; subjects keep their case, domains are lowercased. */
export function parseAllowlist(
  subjects: string | undefined,
  emailDomains: string | undefined,
): Allowlist {
  return {
    subjects: splitList(subjects),
    emailDomains: splitList(emailDomains).map((domain) => domain.toLowerCase()),
  };
}

/** An empty allowlist allows nobody (fail closed). */
export function isAllowed(identity: OidcIdentity, allow: Allowlist): boolean {
  if (allow.subjects.includes(identity.sub)) return true;
  // An IdP may let users set an unverified address in any domain, so the domain rule needs the claim.
  if (!identity.emailVerified) return false;
  const at = identity.email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = identity.email.slice(at + 1).toLowerCase();
  return domain !== "" && allow.emailDomains.includes(domain);
}
