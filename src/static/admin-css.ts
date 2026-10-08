// Stylesheet as a string module (decision 007). No external fonts, URLs or @import. Colors are
// custom properties so the dark scheme only has to redefine them.
export const ADMIN_CSS = `
:root {
  --primary: #417690;
  --secondary: #79aec8;
  --accent: #f5dd5d;
  --header-bg: #417690;
  --header-fg: #f5dd5d;
  --breadcrumbs-bg: #79aec8;
  --breadcrumbs-fg: #c4dce8;
  --body-bg: #fff;
  --body-fg: #333;
  --body-quiet: #666;
  --border: #ccc;
  --row-alt: #f9f9f9;
  --module-header-bg: #79aec8;
  --module-header-fg: #fff;
  --link: #447e9b;
  --link-hover: #036;
  --button-bg: #417690;
  --button-fg: #fff;
  --delete-bg: #ba2121;
  --error-fg: #ba2121;
  --error-bg: #fff0f0;
  --success-bg: #dfd;
  --warning-bg: #ffc;
  --message-error-bg: #ffefef;
  --selected-bg: #ffc;
}

@media (prefers-color-scheme: dark) {
  :root {
    --primary: #264b5d;
    --secondary: #447e9b;
    --accent: #f5dd5d;
    --header-bg: #264b5d;
    --header-fg: #f5dd5d;
    --breadcrumbs-bg: #1f3a48;
    --breadcrumbs-fg: #9ec3d6;
    --body-bg: #121212;
    --body-fg: #e0e0e0;
    --body-quiet: #a0a0a0;
    --border: #3a3a3a;
    --row-alt: #1b1b1b;
    --module-header-bg: #264b5d;
    --module-header-fg: #f0f0f0;
    --link: #81d4fa;
    --link-hover: #b3e5fc;
    --button-bg: #447e9b;
    --button-fg: #fff;
    --delete-bg: #ba2121;
    --error-fg: #ff8a80;
    --error-bg: #3b1d1d;
    --success-bg: #1e3a24;
    --warning-bg: #3d3a1a;
    --message-error-bg: #3b1d1d;
    --selected-bg: #3d3a1a;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--body-bg);
  color: var(--body-fg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

a { color: var(--link); text-decoration: none; }
a:hover { color: var(--link-hover); text-decoration: underline; }

#header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 40px;
  background: var(--header-bg);
  color: var(--header-fg);
}
#header a { color: var(--header-fg); }
#header form { display: inline; margin: 0; }
#header button {
  background: none;
  border: 0;
  color: var(--header-fg);
  cursor: pointer;
  font: inherit;
  text-transform: uppercase;
}

.breadcrumbs {
  padding: 10px 40px;
  background: var(--breadcrumbs-bg);
  color: var(--breadcrumbs-fg);
}
.breadcrumbs a { color: var(--body-bg); }

#content { padding: 20px 40px; }
#content h1 { margin: 0 0 20px; font-size: 20px; font-weight: 300; color: var(--body-quiet); }

.messagelist { margin: 0; padding: 0; list-style: none; }
.messagelist li { padding: 10px 40px; background: var(--success-bg); border-bottom: 1px solid var(--border); }
.messagelist .success { background: var(--success-bg); }
.messagelist .warning { background: var(--warning-bg); }
.messagelist .error { background: var(--message-error-bg); color: var(--error-fg); }

.errornote {
  margin: 0 0 20px;
  padding: 10px 12px;
  border: 1px solid var(--error-fg);
  background: var(--error-bg);
  color: var(--error-fg);
  font-weight: 700;
}
.errorlist { margin: 4px 0; padding: 0; list-style: none; color: var(--error-fg); }

table { border-collapse: collapse; width: 100%; }
th, td { padding: 8px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
thead th { background: var(--module-header-bg); color: var(--module-header-fg); font-weight: 600; }
thead th a { color: var(--module-header-fg); }
tbody tr:nth-child(even) { background: var(--row-alt); }
tr.selected { background: var(--selected-bg); }

.module { margin-bottom: 30px; border: 1px solid var(--border); }
.module h2 { margin: 0; padding: 8px; background: var(--module-header-bg); color: var(--module-header-fg); font-size: 14px; }

#changelist { display: flex; align-items: flex-start; gap: 20px; }
#changelist .changelist-form-container { flex: 1 1 auto; min-width: 0; }
#changelist-filter {
  order: 2;
  flex: 0 0 240px;
  border: 1px solid var(--border);
  background: var(--row-alt);
}
#changelist-filter h2 { margin: 0; padding: 8px 12px; background: var(--module-header-bg); color: var(--module-header-fg); font-size: 14px; }
#changelist-filter h3 { margin: 0; padding: 8px 12px 0; font-size: 13px; color: var(--body-quiet); }
#changelist-filter ul { margin: 0; padding: 4px 12px 8px; list-style: none; }
#changelist-filter .selected a { color: var(--link-hover); font-weight: 700; }

.results { overflow-x: auto; }

.form-row { padding: 10px 12px; border-bottom: 1px solid var(--border); }
.form-row label { display: inline-block; min-width: 160px; font-weight: 700; }
input[type=text], input[type=password], input[type=number], input[type=date], input[type=datetime-local], select, textarea {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--body-bg);
  color: var(--body-fg);
  font: inherit;
}

button, .button {
  padding: 6px 12px;
  border: 0;
  border-radius: 4px;
  background: var(--button-bg);
  color: var(--button-fg);
  cursor: pointer;
  font: inherit;
}
a.deletelink, button.deletelink { background: var(--delete-bg); color: var(--button-fg); padding: 6px 12px; border-radius: 4px; }

.paginator { margin: 12px 0; color: var(--body-quiet); }
.paginator .this-page { font-weight: 700; }

@media (max-width: 767px) {
  #header { padding: 10px 16px; }
  .breadcrumbs, .messagelist li { padding-left: 16px; padding-right: 16px; }
  #content { padding: 16px; }
  #changelist { flex-direction: column; align-items: stretch; }
  #changelist-filter { order: -1; flex: 0 0 auto; width: 100%; float: none; }
  .form-row label { display: block; min-width: 0; margin-bottom: 4px; }
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
