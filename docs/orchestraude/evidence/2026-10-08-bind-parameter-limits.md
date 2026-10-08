---
id: 2026-10-08-bind-parameter-limits
question: For decision 045, how many bound parameters can one statement carry on SQLite and PostgreSQL (bulk `_selected` cap)?
source: https://www.sqlite.org/limits.html ; https://www.postgresql.org/docs/current/protocol-message-formats.html (Bind)
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- SQLite `SQLITE_MAX_VARIABLE_NUMBER` defaults to 32766 since 3.32.0 (2020-05-22) and to 999 before; it can be lowered at runtime with `sqlite3_limit`.
- PostgreSQL's Bind message carries the parameter count as an Int16, which bounds the parameters per statement (the audit observed the practical limit as 65535).
- The audit reproduced a 500 on SQLite with more than about 32k `_selected` ids (security-audit dynamic.md 6b).
Not confirmed: the SQLite version and limit of drivers other than better-sqlite3 (libsql, bun, D1, sql.js).
