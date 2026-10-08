import { jsx } from "hono/jsx";
import { can } from "../auth/permissions.js";
import { classifyDbError, isDbError } from "../data/errors.js";
import { messages } from "../messages.js";
import type { HookCtx } from "../types.js";
import { DeletePage } from "../views/delete.js";
import {
  type AdminContext,
  errorPage,
  modelOr404,
  pageChrome,
  redirectWithFlash,
  renderPage,
  requireUser,
} from "./context.js";

const enc = (pk: unknown): string => encodeURIComponent(String(pk));

/** `GET|POST ${prefix}/:model/:pk/delete/` */
export async function deleteHandler(c: AdminContext): Promise<Response> {
  const found = modelOr404(c, c.req.param("model") ?? "");
  if (found instanceof Response) return found;
  const model = found;
  const user = requireUser(c);
  if (!can(model, "delete", user)) return errorPage(c, 403, messages.forbidden);

  const pk = c.req.param("pk") ?? "";
  const { repo, state } = c.var;
  const row = await repo.get(model.meta, pk);
  if (row === null) return errorPage(c, 404, messages.notFound);

  const listUrl = `${state.config.prefix}/${model.slug}/`;
  const label = model.toString(row);

  if (c.req.method !== "POST") {
    const cancelHref = `${listUrl}${enc(row[model.meta.pk.key])}/change/`;
    const title = `${messages.delete}: ${label}`;
    return renderPage(c, 200, (flash) =>
      jsx(DeletePage, {
        ...pageChrome(c, title, [{ label: model.label, href: listUrl }, { label: title }], flash),
        modelLabel: model.label,
        objectLabel: label,
        cancelHref,
      }),
    );
  }

  const ctx: HookCtx = { mode: "delete", user, db: state.config.db };
  try {
    await model.hooks.beforeDelete?.(row, ctx);
  } catch {
    // The message is never shown (decision 013 item 10).
    return redirectWithFlash(c, listUrl, [{ level: "error", text: messages.hookFailed }]);
  }

  let n: number;
  try {
    n = await repo.delete(model.meta, [pk]);
  } catch (err) {
    // Anything that is not a database error is a bug and goes to onError.
    if (!isDbError(err)) throw err;
    const text = classifyDbError(err) === "foreignKey" ? messages.dbForeignKey : messages.dbOther;
    return redirectWithFlash(c, listUrl, [{ level: "error", text }]);
  }
  // 0 rows: the row vanished between the lookup and the delete.
  return redirectWithFlash(
    c,
    listUrl,
    n > 0
      ? [{ level: "success", text: messages.deleted(label) }]
      : [{ level: "warning", text: messages.alreadyDeleted(label) }],
  );
}
