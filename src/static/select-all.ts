// Inline script for the "select all" checkbox. It is rendered as a JSX child, which Hono escapes,
// so the source must not contain & < > " ' (decision 007): template literals replace quotes and
// the loop avoids comparison and logical operators.
export const SELECT_ALL_SCRIPT =
  "const t = document.getElementById(`action-toggle`); if (t) { t.hidden = false; t.addEventListener(`change`, function () { for (const c of document.querySelectorAll(`input[name=_selected]`)) { c.checked = t.checked } }) }";
