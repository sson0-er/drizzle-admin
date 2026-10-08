// Stylesheet as a string module (decision 007). No external fonts, URLs or @import. Colors are
// custom properties so the dark scheme only has to redefine them.
// Colors and sizes are inspired by the public token values of the Digital Agency design system
// (DADS, @digital-go-jp/design-tokens 2.0.1, MIT). This stylesheet is our own work; it is not
// part of DADS and is not made or endorsed by the Digital Agency.
export const ADMIN_CSS = `
:root {
  color-scheme: light dark;
  --body-bg: #ffffff;
  --body-fg: #333333;
  --heading-fg: #1a1a1a;
  --body-quiet: #666666;
  --surface-alt: #f2f2f2;
  --border: #949494;
  --border-strong: #666666;
  --border-hover: #1a1a1a;
  --link: #00118f;
  --link-hover: #000071;
  --primary: #0017c1;
  --primary-hover: #00118f;
  --primary-active: #000060;
  --on-primary: #ffffff;
  --primary-tint: #c5d7fb;
  --selected-bg: #e8f1fe;
  --danger: #ce0000;
  --danger-hover: #a90000;
  --danger-active: #850000;
  --on-danger: #ffffff;
  --danger-tint: #fdeeee;
  --error-fg: #ce0000;
  --icon-success: #197a4b;
  --icon-warning: #927200;
  --focus-outline: #000000;
  --focus-halo: #ffd43d;
  --focus-fill: #ffd43d;
  --on-focus-fill: #000000;
}

@media (prefers-color-scheme: dark) {
  :root {
    --body-bg: #1a1a1a;
    --body-fg: #f2f2f2;
    --heading-fg: #ffffff;
    --body-quiet: #b3b3b3;
    --surface-alt: #262626;
    --border: #767676;
    --border-strong: #999999;
    --border-hover: #e6e6e6;
    --link: #9db7f9;
    --link-hover: #c5d7fb;
    --primary: #9db7f9;
    --primary-hover: #c5d7fb;
    --primary-active: #d9e6ff;
    --on-primary: #000060;
    --primary-tint: #000071;
    --selected-bg: #000071;
    --danger: #ff7171;
    --danger-hover: #ff9696;
    --danger-active: #ffbbbb;
    --on-danger: #1a1a1a;
    --danger-tint: #620000;
    --error-fg: #ff7171;
    --icon-success: #71c598;
    --icon-warning: #ffc700;
    --focus-outline: #ffd43d;
    --focus-halo: #000000;
    --focus-fill: #ffd43d;
    --on-focus-fill: #000000;
  }
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--body-bg);
  color: var(--body-fg);
  font-family: "Noto Sans JP", "Noto Sans CJK JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  letter-spacing: 0.02em;
}
a { color: var(--link); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { color: var(--link-hover); text-decoration-thickness: 3px; }
h1, h2, h3 { color: var(--heading-fg); font-weight: 700; line-height: 1.5; }

#header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 40px;
  background: var(--body-bg);
  color: var(--body-fg);
  border-bottom: 1px solid var(--border);
}
.site-title { color: var(--heading-fg); font-size: 20px; font-weight: 700; text-decoration: none; }
.site-title:hover { color: var(--heading-fg); text-decoration: underline; }
.user-tools { display: flex; align-items: center; gap: 16px; font-size: 14px; line-height: 1.5; }
.user-name { color: var(--body-quiet); }
#header form { display: inline; margin: 0; }
.breadcrumbs { padding: 12px 40px 0; font-size: 14px; line-height: 1.5; color: var(--body-quiet); }
.breadcrumbs span { color: var(--body-fg); }

.messagelist { display: grid; gap: 8px; margin: 16px 40px 0; padding: 0; list-style: none; }
.messagelist li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border: 3px solid var(--border-strong);
  border-radius: 12px;
  background: var(--body-bg);
  color: var(--body-fg);
  font-weight: 700;
}
.messagelist .success { border-color: var(--icon-success); }
.messagelist .warning { border-color: var(--icon-warning); }
.messagelist .error { border-color: var(--error-fg); }
.messagelist .icon { width: 24px; height: 24px; margin: 2px 0 0; }

#content { padding: 24px 40px 40px; }
#content h1 { margin: 0 0 24px; font-size: 28px; letter-spacing: 0.01em; }
.module { margin: 0 0 32px; padding: 0; min-width: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.module h2 { margin: 0; padding: 12px 16px; font-size: 18px; background: var(--surface-alt); border-bottom: 1px solid var(--border); }
.module tr:last-child > * { border-bottom: 0; }
.errornote {
  margin: 0 0 24px;
  padding: 12px 16px;
  border: 3px solid var(--error-fg);
  border-radius: 12px;
  background: var(--body-bg);
  color: var(--error-fg);
  font-weight: 700;
}
.errorlist { margin: 0 0 8px; padding: 0; list-style: none; color: var(--error-fg); }

.form-row { padding: 16px; border-bottom: 1px solid var(--border); }
.form-row:last-child { border-bottom: 0; }
.form-row label { display: inline-block; min-width: 200px; padding-top: 10px; vertical-align: top; font-weight: 700; color: var(--heading-fg); }
.readonly { display: inline-block; padding-top: 10px; }
.help { margin: 4px 0 0; font-size: 14px; color: var(--body-quiet); }
input[type=text], input[type=password], input[type=number], input[type=date], input[type=datetime-local], select, textarea {
  min-height: 48px;
  max-width: 100%;
  padding: 8px 16px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--body-bg);
  color: var(--body-fg);
  font: inherit;
}
textarea { min-height: 120px; width: min(100%, 640px); vertical-align: top; }
/* order: after the input rule above (same specificity) */
input:hover, select:hover, textarea:hover { border-color: var(--border-hover); }
/* order: after the hover rule, so an invalid field keeps its red border on hover */
.errorlist + input, .errorlist + select, .errorlist + textarea { border-color: var(--error-fg); }
input[type=checkbox] { width: 20px; height: 20px; margin: 0; vertical-align: middle; accent-color: var(--primary); }

button, .button, .object-tools a.addlink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 8px 24px;
  border: 1px solid var(--primary);
  border-radius: 8px;
  background: var(--primary);
  color: var(--on-primary);
  font: inherit;
  font-weight: 700;
  line-height: 1.5;
  text-decoration: none;
  cursor: pointer;
}
button:hover, .button:hover, .object-tools a.addlink:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  color: var(--on-primary);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
button:active, .button:active, .object-tools a.addlink:active { background: var(--primary-active); border-color: var(--primary-active); }

#changelist-search button, button[name=index], button[name=_addanother], button[name=_continue] {
  background: var(--body-bg);
  border-color: currentColor;
  color: var(--primary);
}
#changelist-search button:hover, button[name=index]:hover, button[name=_addanother]:hover, button[name=_continue]:hover {
  background: var(--primary-tint);
  color: var(--primary-hover);
}

#header button {
  min-height: 36px;
  padding: 4px 8px;
  border-color: transparent;
  background: transparent;
  color: var(--link);
  font-size: 14px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
#header button:hover { background: transparent; color: var(--link-hover); text-decoration-thickness: 3px; }
.submit-row a:not(.deletelink) { display: inline-flex; align-items: center; min-height: 48px; padding: 8px 16px; font-weight: 700; }

#delete-form button[type=submit], form.delete-action button[type=submit] {
  background: var(--danger);
  border-color: var(--danger);
  color: var(--on-danger);
}
#delete-form button[type=submit]:hover, form.delete-action button[type=submit]:hover {
  background: var(--danger-hover);
  border-color: var(--danger-hover);
  color: var(--on-danger);
}
#delete-form button[type=submit]:active, form.delete-action button[type=submit]:active {
  background: var(--danger-active);
  border-color: var(--danger-active);
}
a.deletelink, button.deletelink {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 8px 24px;
  border: 1px solid currentColor;
  border-radius: 8px;
  background: var(--body-bg);
  color: var(--danger);
  font-weight: 700;
  text-decoration: none;
}
a.deletelink:hover, button.deletelink:hover { background: var(--danger-tint); color: var(--danger-hover); text-decoration: underline; }

.submit-row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 24px 0 0; }
.submit-row a.deletelink { margin-inline-start: auto; }
.confirm-text { margin: 0 0 16px; }
ul.objects { margin: 0 0 24px; padding-inline-start: 1.5em; }

.object-tools { display: flex; justify-content: flex-end; gap: 8px; margin: 0 0 16px; padding: 0; list-style: none; }
#changelist { display: flex; align-items: flex-start; gap: 24px; }
#changelist .changelist-form-container { flex: 1 1 auto; min-width: 0; }
#changelist-search, #changelist-form .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 16px; }
#changelist-search input, #changelist-search button, #changelist-form .actions select, #changelist-form .actions button {
  min-height: 40px;
  padding: 4px 12px;
  line-height: 1.5;
}
#changelist-search input { flex: 1 1 240px; max-width: 480px; }
.results { overflow-x: auto; }

table { border-collapse: collapse; width: 100%; font-size: 14px; line-height: 1.5; }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
thead th { border-bottom: 2px solid var(--border-strong); color: var(--heading-fg); font-weight: 700; white-space: nowrap; }
tbody th { color: var(--heading-fg); font-weight: 700; }
tbody tr:nth-child(even) { background: var(--surface-alt); }
tr.selected { background: var(--selected-bg); }

#changelist-filter {
  order: 2;
  flex: 0 0 240px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--body-bg);
  font-size: 14px;
  line-height: 1.5;
}
#changelist-filter h2 {
  margin: 0;
  padding: 8px 12px;
  font-size: 16px;
  background: var(--surface-alt);
  border-bottom: 1px solid var(--border);
  border-radius: 7px 7px 0 0;
}
#changelist-filter h3 { margin: 0; padding: 12px 12px 0; font-size: 14px; color: var(--body-quiet); }
#changelist-filter ul { margin: 0; padding: 4px 12px 12px; list-style: none; }
#changelist-filter li { padding: 2px 4px; border-radius: 4px; }
#changelist-filter .selected { background: var(--selected-bg); }
#changelist-filter .selected a { color: var(--body-fg); font-weight: 700; text-decoration: none; }

.paginator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 16px 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--body-quiet);
}
.paginator a, .paginator .this-page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
  padding: 0 8px;
  border-radius: 6px;
}
.paginator a { border: 1px solid var(--border); text-decoration: none; }
.paginator a:hover { background: var(--primary-tint); color: var(--primary-hover); text-decoration: underline; }
.paginator .this-page { border: 1px solid var(--primary); background: var(--primary); color: var(--on-primary); font-weight: 700; }
.paginator .result-count { margin-inline-start: 8px; }

.icon { display: inline-block; width: 1em; height: 1em; vertical-align: -0.125em; margin-inline-end: 0.35em; flex-shrink: 0; }
.boolean-mark .icon { margin-inline-end: 0; }
.boolean-mark[data-bool=true], .messagelist .success .icon { color: var(--icon-success); }
.boolean-mark[data-bool=false], .messagelist .error .icon { color: var(--error-fg); }
.messagelist .warning .icon { color: var(--icon-warning); }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

:focus-visible { outline: 4px solid var(--focus-outline); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-halo); }
:is(a, #header button):focus-visible { background: var(--focus-fill); color: var(--on-focus-fill); }
:is(a, #header button):focus-visible :is(.icon, .boolean-mark) { color: inherit; }

@media (max-width: 767px) {
  #header { padding: 12px 16px; }
  .breadcrumbs { padding-left: 16px; padding-right: 16px; }
  .messagelist { margin-left: 16px; margin-right: 16px; }
  #content { padding: 16px; }
  #content h1 { font-size: 24px; }
  #changelist { flex-direction: column; align-items: stretch; }
  #changelist-filter { order: -1; flex: 0 0 auto; width: 100%; float: none; }
  .form-row label { display: block; min-width: 0; margin-bottom: 4px; padding-top: 0; }
  .readonly { padding-top: 0; }
  .submit-row > * { flex: 1 1 100%; justify-content: center; }
  .submit-row a.deletelink { margin-inline-start: 0; }
  .results { overflow-x: auto; }
}
`;

// FNV-1a 32-bit. The hash only busts caches; it needs no cryptographic strength.
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const ADMIN_CSS_VERSION: string = fnv1a(ADMIN_CSS);
