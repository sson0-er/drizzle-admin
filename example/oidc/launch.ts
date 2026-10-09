import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { writeLocalhostCert } from "./cert.js";
import { assertTlsVerificationOn, selectMode } from "./mode.js";

try {
  assertTlsVerificationOn(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const serverPath = fileURLToPath(new URL("./server.ts", import.meta.url));

let env = process.env;
let certDir: string | null = null;
if (selectMode(process.env) === "mock") {
  const { dir, certPath } = await writeLocalhostCert();
  certDir = dir;
  // The extra CA is given to the child only, so it alone trusts the generated certificate.
  env = { ...process.env, NODE_EXTRA_CA_CERTS: certPath, OIDC_MOCK_CERT_DIR: dir };
}

function removeCertDir(): void {
  if (certDir) rmSync(certDir, { recursive: true, force: true });
}

const child = spawn(process.execPath, ["--import", "tsx", serverPath], { stdio: "inherit", env });

// The child shuts down on the signal; the launcher keeps waiting so that it can clean up after it.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(error.message);
  removeCertDir();
  process.exit(1);
});
child.on("exit", (code) => {
  removeCertDir();
  process.exit(code ?? 1);
});
