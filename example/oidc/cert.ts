import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "selfsigned";

const CERT_FILE = "cert.pem";
const KEY_FILE = "key.pem";
const VALID_DAYS = 30;

/** A fresh self-signed certificate for `localhost` / `127.0.0.1`; nothing is written to disk. */
export async function generateLocalhostCert(): Promise<{ key: string; cert: string }> {
  const result = await generate([{ name: "commonName", value: "localhost" }], {
    keyType: "ec",
    // The default algorithm is sha1.
    algorithm: "sha256",
    notAfterDate: new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000),
    extensions: [
      { name: "basicConstraints", cA: false },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
        ],
      },
    ],
  });
  return { key: result.private, cert: result.cert };
}

/** Writes a new certificate and key into a private temporary directory; the caller removes it. */
export async function writeLocalhostCert(): Promise<{ dir: string; certPath: string }> {
  const { key, cert } = await generateLocalhostCert();
  const dir = mkdtempSync(join(tmpdir(), "drizzle-admin-oidc-"));
  const certPath = join(dir, CERT_FILE);
  writeFileSync(certPath, cert);
  writeFileSync(join(dir, KEY_FILE), key, { mode: 0o600 });
  return { dir, certPath };
}

export function readLocalhostCert(dir: string): { key: string; cert: string } {
  return {
    key: readFileSync(join(dir, KEY_FILE), "utf8"),
    cert: readFileSync(join(dir, CERT_FILE), "utf8"),
  };
}
