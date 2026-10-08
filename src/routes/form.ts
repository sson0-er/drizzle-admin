import { jsx } from "hono/jsx";
import { can } from "../auth/permissions.js";
import { classifyDbError, isDbError } from "../data/errors.js";
import type { DbRow } from "../data/repository.js";
import { rawValues } from "../forms/coerce.js";
import {
  buildFormGroups,
  type Choice,
  editableFields,
  type FormGroup,
  type FormMode,
} from "../forms/fields.js";
import { validateSubmission } from "../forms/validate.js";
import { toFormValue } from "../forms/widgets.js";
import { messages } from "../messages.js";
import type { HookCtx, ResolvedModel } from "../types.js";
import { FormPage } from "../views/form.js";
import {
  type AdminContext,
  defaultOrdering,
  errorPage,
  modelOr404,
  pageChrome,
  redirectWithFlash,
  renderPage,
  requireUser,
} from "./context.js";

/** More choices than this and a foreign key falls back to a plain input (forms.md). */
const FK_CHOICE_LIMIT = 200;

const enc = (pk: unknown): string => encodeURIComponent(String(pk));

const DB_MESSAGES = {
  unique: messages.dbUnique,
  foreignKey: messages.dbForeignKey,
  notNull: messages.dbNotNull,
  other: messages.dbOther,
} as const;

/** What a failed submission puts back on the form. */
interface FormErrors {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formErrors: string[];
}

/** Choices of every FK field that can appear on the form, one `options` query per field. */
async function loadFkChoices(
  c: AdminContext,
  model: ResolvedModel,
): Promise<Map<string, Choice[] | "tooMany" | "noView">> {
  const { repo, state } = c.var;
  const user = requireUser(c);
  const choices = new Map<string, Choice[] | "tooMany" | "noView">();
  const keys = new Set(model.fieldsets.flatMap((fieldset) => fieldset.fields));
  for (const field of model.meta.fields) {
    const slug = field.foreignKey?.slug;
    if (slug === undefined || !keys.has(field.key)) continue;
    const ref = state.models.get(slug);
    if (ref === undefined) continue;
    // Without `view` on the referenced model its labels must not leak (decision 034).
    if (!can(ref, "view", user)) {
      choices.set(field.key, "noView");
      continue;
    }
    const options = await repo.options(ref.meta, {
      limit: FK_CHOICE_LIMIT + 1,
      ordering: defaultOrdering(ref),
      toLabel: ref.toString,
    });
    choices.set(field.key, options.length > FK_CHOICE_LIMIT ? "tooMany" : options);
  }
  return choices;
}

async function loadGroups(
  c: AdminContext,
  model: ResolvedModel,
  mode: FormMode,
  canChange: boolean,
): Promise<FormGroup[]> {
  const fkChoices = await loadFkChoices(c, model);
  return buildFormGroups({
    model,
    mode,
    canChange,
    prefix: c.var.state.config.prefix,
    fkChoices,
    refSlugOf: (key) => model.meta.fields.find((f) => f.key === key)?.foreignKey?.slug,
  });
}

interface RenderArgs {
  model: ResolvedModel;
  mode: FormMode;
  groups: FormGroup[];
  status: 200 | 400;
  title: string;
  canSave: boolean;
  values: Record<string, string>;
  fieldErrors?: Record<string, string>;
  formErrors?: string[];
  row?: DbRow;
  deleteHref?: string;
}

function renderForm(c: AdminContext, args: RenderArgs): Promise<Response> {
  const { model, mode, groups, status, title, canSave, values, row, deleteHref } = args;
  const listUrl = `${c.var.state.config.prefix}/${model.slug}/`;
  return renderPage(c, status, (flash) =>
    jsx(FormPage, {
      ...pageChrome(c, title, [{ label: model.label, href: listUrl }, { label: title }], flash),
      mode,
      modelLabel: model.label,
      groups,
      values,
      fieldErrors: args.fieldErrors ?? {},
      formErrors: args.formErrors ?? [],
      canSave,
      timeZone: c.var.state.config.timeZone,
      ...(deleteHref === undefined ? {} : { deleteHref }),
      ...(row === undefined ? {} : { displayRow: row }),
    }),
  );
}

/**
 * Pipeline steps 1-6 shared by add and change. Returns the saved row, or the errors to show again.
 * A row of `null` means `update` found nothing (the row vanished since it was loaded).
 */
async function save(
  c: AdminContext,
  model: ResolvedModel,
  mode: FormMode,
  groups: FormGroup[],
  pk: string | null,
): Promise<{ row: DbRow | null; afterSaveFailed: boolean } | FormErrors> {
  const { repo, state } = c.var;
  const fields = editableFields(groups);
  const body = c.var.body ?? {};
  const validated = await validateSubmission({
    model,
    fields,
    body,
    mode,
    timeZone: state.config.timeZone,
  });
  if (!validated.ok) return validated;

  const failure = (message: string): FormErrors => ({
    values: rawValues(fields, body),
    fieldErrors: {},
    formErrors: [message],
  });
  const ctx: HookCtx = { mode, user: requireUser(c), db: state.config.db };

  let data = validated.data;
  if (model.hooks.beforeSave !== undefined) {
    try {
      data = await model.hooks.beforeSave(data, ctx);
    } catch {
      // The message is never shown (decision 013 item 10).
      return failure(messages.hookFailed);
    }
  }

  let row: DbRow | null;
  try {
    row =
      pk === null ? await repo.create(model.meta, data) : await repo.update(model.meta, pk, data);
  } catch (err) {
    // Anything that is not a database error is a bug and goes to onError.
    if (!isDbError(err)) throw err;
    return failure(DB_MESSAGES[classifyDbError(err)]);
  }
  if (row === null) return { row, afterSaveFailed: false };

  let afterSaveFailed = false;
  try {
    await model.hooks.afterSave?.(row, ctx);
  } catch {
    afterSaveFailed = true;
  }
  return { row, afterSaveFailed };
}

const isFailure = (r: Awaited<ReturnType<typeof save>>): r is FormErrors => "values" in r;

/** The 303 after a successful save; the buttons decide where it goes. */
function redirectAfterSave(
  c: AdminContext,
  model: ResolvedModel,
  mode: FormMode,
  row: DbRow,
  afterSaveFailed: boolean,
): Promise<Response> {
  const base = `${c.var.state.config.prefix}/${model.slug}/`;
  const body = c.var.body ?? {};
  const label = model.toString(row);
  const success = mode === "add" ? messages.added(label) : messages.changed(label);
  const changeUrl = `${base}${enc(row[model.meta.pk.key])}/change/`;
  let location = base;
  if (mode === "add") {
    if ("_addanother" in body) location = `${base}add/`;
    else if ("_continue" in body) location = changeUrl;
  } else if ("_continue" in body) {
    location = changeUrl;
  } else if ("_addanother" in body) {
    location = `${base}add/`;
  }
  return redirectWithFlash(c, location, [
    { level: "success", text: success },
    ...(afterSaveFailed ? [{ level: "warning" as const, text: messages.afterSaveFailed }] : []),
  ]);
}

/** `GET|POST ${prefix}/:model/add/` */
export async function addHandler(c: AdminContext): Promise<Response> {
  const found = modelOr404(c, c.req.param("model") ?? "");
  if (found instanceof Response) return found;
  const model = found;
  const user = requireUser(c);
  if (!can(model, "add", user)) return errorPage(c, 403, messages.forbidden);

  const groups = await loadGroups(c, model, "add", true);
  const title = `${messages.add}: ${model.label}`;
  const page = { model, mode: "add", groups, title, canSave: true } as const;

  if (c.req.method !== "POST") return renderForm(c, { ...page, status: 200, values: {} });

  const result = await save(c, model, "add", groups, null);
  if (isFailure(result)) return renderForm(c, { ...page, status: 400, ...result });
  // `create` always returns a row.
  return redirectAfterSave(c, model, "add", result.row as DbRow, result.afterSaveFailed);
}

/** `GET|POST ${prefix}/:model/:pk/change/` (GET needs `view`, POST needs `change`). */
export async function changeHandler(c: AdminContext): Promise<Response> {
  const found = modelOr404(c, c.req.param("model") ?? "");
  if (found instanceof Response) return found;
  const model = found;
  const user = requireUser(c);
  const isPost = c.req.method === "POST";
  if (!can(model, isPost ? "change" : "view", user)) return errorPage(c, 403, messages.forbidden);

  const pk = c.req.param("pk") ?? "";
  const row = await c.var.repo.get(model.meta, pk);
  if (row === null) return errorPage(c, 404, messages.notFound);

  const { prefix, timeZone } = c.var.state.config;
  const canChange = can(model, "change", user);
  const groups = await loadGroups(c, model, "change", canChange);
  const title = `${messages.change}: ${model.toString(row)}`;
  const page = {
    model,
    mode: "change",
    groups,
    title,
    canSave: canChange,
    row,
    ...(can(model, "delete", user)
      ? { deleteHref: `${prefix}/${model.slug}/${enc(row[model.meta.pk.key])}/delete/` }
      : {}),
  } as const;

  if (!isPost) {
    const values: Record<string, string> = {};
    for (const field of editableFields(groups)) {
      values[field.key] = toFormValue(field, row[field.key], timeZone);
    }
    return renderForm(c, { ...page, status: 200, values });
  }

  const result = await save(c, model, "change", groups, pk);
  if (isFailure(result)) return renderForm(c, { ...page, status: 400, ...result });
  if (result.row === null) return errorPage(c, 404, messages.notFound);
  return redirectAfterSave(c, model, "change", result.row, result.afterSaveFailed);
}
