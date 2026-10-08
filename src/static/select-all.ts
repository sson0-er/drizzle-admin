// Inline script for the "select all" checkbox. It is rendered as a JSX child, which Hono escapes,
// so the source must not contain & < > " ' (decision 007): template literals replace quotes and
// the loop avoids comparison and logical operators.
export const SELECT_ALL_SCRIPT =
  "const t = document.getElementById(`action-toggle`); if (t) { t.hidden = false; t.addEventListener(`change`, function () { for (const c of document.querySelectorAll(`input[name=_selected]`)) { c.checked = t.checked } }) }";

// Base64 SHA-256 of SELECT_ALL_SCRIPT, allowed by the Content-Security-Policy `script-src`
// (decision 044). Whoever edits the script must update this constant; a unit test recomputes it.
export const SELECT_ALL_SCRIPT_SHA256 = "v/peDHOfIZWrfvqqPHbyzhkt2GMZ+0UvE0ARRSfmSAU=";
