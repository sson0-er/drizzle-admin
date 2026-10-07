import { jsx } from "hono/jsx";
import { can } from "../auth/permissions.js";
import { messages } from "../messages.js";
import { DashboardPage } from "../views/dashboard.js";
import { type AdminContext, pageChrome, renderPage, requireUser } from "./context.js";

/** `GET ${prefix}/`: the models the user may view, in registration order. */
export function dashboardHandler(c: AdminContext): Promise<Response> {
  const user = requireUser(c);
  const models = [...c.var.state.models.values()]
    .filter((m) => can(m, "view", user))
    .map((m) => ({ slug: m.slug, label: m.label, canAdd: can(m, "add", user) }));
  return renderPage(c, 200, (flash) =>
    jsx(DashboardPage, {
      ...pageChrome(c, messages.home, [], flash),
      // The dashboard is Home itself, so the crumb is not a link here.
      breadcrumbs: [{ label: messages.home }],
      models,
    }),
  );
}
