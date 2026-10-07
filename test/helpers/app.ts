import type { Table } from "drizzle-orm";
import {
  type Admin,
  type AdminConfig,
  createAdmin,
  type ModelAdminOptions,
} from "../../src/index.js";
import type { DialectFixture, FixtureSchema } from "./db.js";
import { attr, parse, qs } from "./html.js";

export const TEST_SECRET = "test-secret-test-secret-test-secret-0123";
export const TEST_USER = { id: "1", name: "tester" };
export const TEST_PASSWORD = "pw";

type FormValue = string | string[];
type Fetch = (request: Request) => Response | Promise<Response>;

export interface Client {
  /** Sends a request with the cookie jar; never follows redirects. */
  request(path: string, init?: RequestInit): Promise<Response>;
  get(path: string, headers?: Record<string, string>): Promise<Response>;
  /** Form-encoded POST with `Origin: http://localhost`; `_csrf` is added unless `withToken` is false. */
  post(
    path: string,
    form?: Record<string, FormValue>,
    opts?: { withToken?: boolean; headers?: Record<string, string> },
  ): Promise<Response>;
  /** The CSRF token of the last HTML page, or of the session cookie when that page has none. */
  csrf(): string;
  /** Current value (still URL-encoded) of a cookie in the jar. */
  cookie(name: string): string | undefined;
}

const ORIGIN = "http://localhost";

/** Cookie-jar client over any fetch function (e.g. `admin.fetch` or an outer app's `fetch`). */
export function createClient(fetchFn: Fetch): Client {
  const jar = new Map<string, string>();
  let lastHtml = "";

  const store = (res: Response) => {
    for (const line of res.headers.getSetCookie()) {
      const [pair = "", ...attrs] = line.split(";").map((part) => part.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const expired = attrs.some((a) => /^max-age=0$/i.test(a)) || value === "";
      if (expired) jar.delete(name);
      else jar.set(name, value);
    }
  };

  const request: Client["request"] = async (path, init = {}) => {
    const headers = new Headers(init.headers);
    if (jar.size > 0) {
      headers.set("Cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    }
    const res = await fetchFn(
      new Request(`${ORIGIN}${path}`, { ...init, headers, redirect: "manual" }),
    );
    store(res);
    if (res.headers.get("Content-Type")?.startsWith("text/html")) {
      lastHtml = await res.clone().text();
    }
    return res;
  };

  const csrf = (): string => {
    const input = qs(parse(lastHtml), { tag: "input", attrs: { name: "_csrf" } });
    const fromPage = input === null ? null : attr(input, "value");
    if (fromPage !== null && fromPage !== "") return fromPage;
    // Cookie value: URL-encoded `<json>.<signature>`; the JSON itself may contain dots.
    const raw = jar.get("da_session");
    if (raw === undefined) throw new Error("csrf(): no page with a token and no session cookie");
    const signed = decodeURIComponent(raw);
    const payload = JSON.parse(signed.slice(0, signed.lastIndexOf("."))) as { csrf: string };
    return payload.csrf;
  };

  return {
    request,
    get: (path, headers) => request(path, { method: "GET", ...(headers ? { headers } : {}) }),
    post: (path, form = {}, opts = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(form)) {
        for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
      }
      if (opts.withToken ?? true) params.set("_csrf", csrf());
      return request(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: ORIGIN,
          ...opts.headers,
        },
        body: params.toString(),
      });
    },
    csrf,
    cookie: (name) => jar.get(name),
  };
}

export interface Overrides {
  /** Merged over the defaults, so `auth` replaces the default builtin auth wholesale. */
  config?: Partial<AdminConfig>;
  /** Options per fixture table; `null` leaves the table unregistered. */
  models?: Partial<Record<keyof FixtureSchema, ModelAdminOptions<Table> | null>>;
}

export interface TestAdmin {
  admin: Admin;
  client: Client;
  db: unknown;
  schema: FixtureSchema;
  close(): Promise<void>;
  queryCount(): number;
}

const TABLES = ["authors", "articles", "kv", "events"] as const;

/** Sets up the fixture DB and an admin at `/admin` with the fixture tables registered. */
export async function makeAdmin(
  fixture: DialectFixture,
  overrides: Overrides = {},
): Promise<TestAdmin> {
  const { db, schema, close, queryCount } = await fixture.setup();
  const admin = createAdmin({
    db,
    dialect: fixture.dialect,
    basePath: "/admin",
    secret: TEST_SECRET,
    auth: {
      verifyCredentials: async (username, password) =>
        username === TEST_USER.name && password === TEST_PASSWORD ? TEST_USER : null,
    },
    ...overrides.config,
  });
  for (const name of TABLES) {
    const table = schema[name];
    const options = overrides.models?.[name];
    if (table !== undefined && options !== null) admin.register(table, options);
  }
  return {
    admin,
    client: createClient((req) => admin.fetch(req)),
    db,
    schema,
    close,
    queryCount,
  };
}
