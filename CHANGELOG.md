# Changelog

## Unreleased

### Security

- Sessions and flash messages are signed with keys derived from `secret` and `basePath`, so admin instances no longer accept each other's cookies. **Every user is signed out once after upgrading.**
- Responses carry a Content-Security-Policy and `X-Content-Type-Options: nosniff`.
- Malformed or out-of-range keys, NUL bytes and oversized selections no longer cause 500 errors.
- The external-mode `next` passed to `loginUrl` is sanitized.

### Changed

- Unset `add` / `change` / `delete` permissions follow `view`, and a model with no permission for the user answers 404.
- `sessionMaxAgeSec` above 34560000 (400 days) is rejected.
- The search text is capped at 200 characters, at most 500 rows can be selected for one action, and `listPerPage` above 500 is rejected by `register()`.
- Integer fields reject `0x`/`0b`/exponent notation and unsafe integers.
- `exclude` also removes columns from the default list columns, and identity columns are read-only.
- **The UI is English by default.** Japanese is available from the "English / 日本語" switcher in the header and on the login page, remembered per browser in the `da_lang` cookie for one year. Existing Japanese-speaking users switch once.
- The default `siteTitle` follows the language ("Site administration" / "サイト管理").
- The model slug `_lang` is now reserved (`register()` throws for it); `lang` stays valid.
