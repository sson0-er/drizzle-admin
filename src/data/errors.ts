// DB error classification by driver code. Messages are never read or returned: a DrizzleQueryError
// message embeds the SQL and its bound parameters (decisions 011, 022).
import { DrizzleQueryError } from "drizzle-orm";

export type DbErrorKind = "unique" | "foreignKey" | "notNull" | "other";

const KIND_BY_CODE: Record<string, DbErrorKind> = {
  SQLITE_CONSTRAINT_UNIQUE: "unique",
  SQLITE_CONSTRAINT_PRIMARYKEY: "unique",
  "23505": "unique",
  SQLITE_CONSTRAINT_FOREIGNKEY: "foreignKey",
  "23503": "foreignKey",
  SQLITE_CONSTRAINT_NOTNULL: "notNull",
  "23502": "notNull",
};

// `err` plus up to 5 `.cause` levels. Drivers wrapped by Drizzle keep the code on `cause`.
const MAX_CAUSE_DEPTH = 5;

function* chain(err: unknown): Generator<unknown> {
  let cur = err;
  for (let i = 0; i <= MAX_CAUSE_DEPTH; i++) {
    yield cur;
    if (typeof cur !== "object" || cur === null) return;
    cur = (cur as { cause?: unknown }).cause;
  }
}

function codeOf(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function nameOf(e: unknown): string {
  if (typeof e !== "object" || e === null) return "unknown";
  const name = (e as { name?: unknown }).name;
  return typeof name === "string" && name !== "" ? name : "unknown";
}

function find(err: unknown): { kind: DbErrorKind; name: string; code: string } {
  let firstCoded: { name: string; code: string } | undefined;
  for (const e of chain(err)) {
    const code = codeOf(e);
    if (code === undefined) continue;
    firstCoded ??= { name: nameOf(e), code };
    const kind = KIND_BY_CODE[code];
    if (kind) return { kind, name: nameOf(e), code };
  }
  return { kind: "other", name: firstCoded?.name ?? nameOf(err), code: firstCoded?.code ?? "-" };
}

export function classifyDbError(err: unknown): DbErrorKind {
  return find(err).kind;
}

// `name` and `code` come from driver or user objects, so only a safe charset reaches the log line
// (no newline for log forging, no free text). Classification above still uses the raw code.
const SAFE_LOG_TOKEN = /^[A-Za-z0-9_.-]{1,64}$/;

const logToken = (s: string): string => (SAFE_LOG_TOKEN.test(s) ? s : "-");

/** `"<kind> <name> <code>"` only; never the message, SQL or parameters. */
export function describeForLog(err: unknown): string {
  const { kind, name, code } = find(err);
  return `${kind} ${logToken(name)} ${logToken(code)}`;
}

/** True for a Drizzle query failure or anything carrying a string `code`. `err.name` is not used. */
export function isDbError(err: unknown): boolean {
  for (const e of chain(err)) {
    if (e instanceof DrizzleQueryError || codeOf(e) !== undefined) return true;
  }
  return false;
}
