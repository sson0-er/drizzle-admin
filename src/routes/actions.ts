import { jsx } from "hono/jsx";
import { ACTION_PERMISSION, can } from "../auth/permissions.js";
import { classifyDbError, isDbError } from "../data/errors.js";
import type { HookCtx, ResolvedModel } from "../types.js";
import { ConfirmActionPage } from "../views/confirm-action.js";
import {
  type AdminContext,
  errorPage,
  modelOr404,
  pageChrome,
  redirectWithFlash,
  renderPage,
  requireUser,
} from "./context.js";

const DELETE_ACTION = "delete_selected";
/** Most distinct ids one bulk action takes: keeps the `getMany` / `delete` bind parameters bounded. */
export const MAX_SELECTED = 500;

/** `_selected` as strings (a single value or a repeated field), each id once. */
function selectedIds(body: Record<string, unknown>): string[] {
  const raw = body._selected;
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return [...new Set(values.filter((v): v is string => typeof v === "string"))];
}

/** `POST ${prefix}/:model/`: bulk actions on the selected rows, then PRG back to the list state. */
export async function actionsHandler(c: AdminContext): Promise<Response> {
  const found = modelOr404(c, c.req.param("model") ?? "");
  if (found instanceof Response) return found;
  const model: ResolvedModel = found;
  const user = requireUser(c);
  const { repo, state, t } = c.var;
  const body = c.var.body ?? {};

  const listUrl = `${state.config.prefix}/${model.slug}/`;
  const backQuery = new URL(c.req.url).search;
  const back = `${listUrl}${backQuery}`;
  const flashBack = (level: "success" | "warning" | "error", text: string) =>
    redirectWithFlash(c, back, [{ level, text }]);

  const ids = selectedIds(body);
  if (ids.length === 0) return flashBack("warning", t.noSelection);
  if (ids.length > MAX_SELECTED) {
    return flashBack("warning", t.tooManySelected(MAX_SELECTED));
  }

  const action = typeof body.action === "string" ? body.action : "";
  const confirmed = body._confirm === "1";

  const confirmPage = (actionLabel: string, isDelete: boolean, rows: Record<string, unknown>[]) => {
    const title = actionLabel;
    return renderPage(c, 200, (flash) =>
      jsx(ConfirmActionPage, {
        ...pageChrome(c, title, [{ label: model.label, href: listUrl }, { label: title }], flash),
        modelLabel: model.label,
        action,
        actionLabel,
        isDelete,
        items: rows.map((r) => ({
          pk: String(r[model.meta.pk.key]),
          label: model.toString(r),
        })),
        listHref: listUrl,
        backQuery,
      }),
    );
  };

  if (action === DELETE_ACTION) {
    if (!can(model, "delete", user)) return errorPage(c, 403, t.forbidden);
    const rows = await repo.getMany(model.meta, ids);
    // Every selected row vanished meanwhile: nothing to confirm or delete.
    if (rows.length === 0) return flashBack("warning", t.noSelection);
    if (!confirmed) return confirmPage(t.deleteSelected, true, rows);

    const ctx: HookCtx = { mode: "delete", user, db: state.config.db };
    try {
      for (const row of rows) await model.hooks.beforeDelete?.(row, ctx);
    } catch {
      // The message is never shown (decision 013 item 10).
      return flashBack("error", t.hookFailed);
    }
    try {
      const n = await repo.delete(
        model.meta,
        rows.map((r) => String(r[model.meta.pk.key])),
      );
      return flashBack("success", t.deletedMany(n));
    } catch (err) {
      // Anything that is not a database error is a bug and goes to onError.
      if (!isDbError(err)) throw err;
      return flashBack("error", classifyDbError(err) === "foreignKey" ? t.dbForeignKey : t.dbOther);
    }
  }

  const custom = model.actions.find((a) => a.name === action);
  if (custom === undefined) return flashBack("error", t.unknownAction);
  if (!can(model, ACTION_PERMISSION, user)) return errorPage(c, 403, t.forbidden);

  if (custom.confirm === true && !confirmed) {
    const rows = await repo.getMany(model.meta, ids);
    // Every selected row vanished meanwhile: nothing to confirm.
    if (rows.length === 0) return flashBack("warning", t.noSelection);
    return confirmPage(custom.label, false, rows);
  }
  try {
    const result = await custom.run({ ids, db: state.config.db, user });
    return flashBack("success", result?.message ?? t.actionDone);
  } catch {
    // The message is never shown (decision 013 item 10).
    return flashBack("error", t.actionFailed);
  }
}
