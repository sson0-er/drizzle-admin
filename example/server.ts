import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { createExampleApp } from "./app.js";

const DEFAULT_PASSWORD = "admin";
const secret = process.env.ADMIN_SECRET ?? randomBytes(32).toString("hex");
const adminPassword = process.env.ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
const port = Number(process.env.PORT ?? 3000);
// Loopback by default: the demo ships a default password (decision 038).
const hostname = process.env.HOST ?? "127.0.0.1";

if (process.env.ADMIN_PASSWORD === undefined) {
  console.warn(
    `Warning: ADMIN_PASSWORD is not set; using the default password "${DEFAULT_PASSWORD}".`,
  );
}
if (process.env.ADMIN_SECRET === undefined) {
  console.warn("Note: ADMIN_SECRET is not set; sessions will not survive a restart.");
}

const { app } = await createExampleApp({ secret, adminPassword });
serve({ fetch: app.fetch, port, hostname }, () => {
  const host = hostname.includes(":") ? `[${hostname}]` : hostname;
  console.log(`drizzle-admin demo: http://${host}:${port}/admin/`);
  console.log("Log in as admin (password from ADMIN_PASSWORD, default: admin).");
});
