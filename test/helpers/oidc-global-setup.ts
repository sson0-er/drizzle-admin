import { rmSync } from "node:fs";
import { writeLocalhostCert } from "../../example/oidc/cert.js";

// Node reads NODE_EXTRA_CA_CERTS only at process start, so this runs before the forked workers.
export default async function setup(): Promise<() => void> {
  const { dir, certPath } = await writeLocalhostCert();
  process.env.NODE_EXTRA_CA_CERTS = certPath;
  process.env.OIDC_MOCK_CERT_DIR = dir;
  return () => {
    rmSync(dir, { recursive: true, force: true });
  };
}
