# Interface: support (messages, time)

Files: `src/messages.ts`, `src/time.ts`. No dependencies. Web-standard APIs only (`Intl`).

## Responsibilities
- `messages.ts`: every user-visible UI string (Japanese), in one file (§2). No other source file contains UI text literals. Changed 2026-10-08: glyph-only literals that contain no words are exempt: the paginator's `‹` / `›`, the breadcrumb separator `›`, the boolean cell marks `✓` / `✗`, the null cell `-`, the truncation `…`, the empty choice `---------` and the password mask `********` (decisions 033 item 11, 037). Changed 2026-10-08: icons (decision 039, `src/views/icons.tsx`) are decorative SVG with no text and need no message; the accessible text of a boolean list cell reuses `yes` / `no`, so no key is added. `formatValue` / `formatCell` still return `✓` / `✗` for booleans, but neither list cells nor `DisplayValue` render that text any more; both show `BooleanMark` (Q9).
- `time.ts`: time-zone validation, conversion between `datetime-local` values and instants, date-preset ranges, list date formatting.

## API

### `src/messages.ts`
Changed 2026-10-08: `alreadyDeleted` added for a single delete that removed 0 rows (decision 036).
```ts
export const messages = {
  defaultSiteTitle: "サイト管理",
  // navigation / dashboard
  home: "ホーム", add: "追加", change: "変更", delete: "削除", logout: "ログアウト",
  // list
  search: "検索", searchPlaceholder: "検索", filter: "フィルター", all: "すべて",
  yes: "はい", no: "いいえ", today: "今日", past7: "過去 7 日間", thisMonth: "今月", thisYear: "今年",
  action: "操作", run: "実行", selectAll: "すべて選択", deleteSelected: "選択された項目の削除",
  resultCount: (n: number) => `${n} 件`, noSelection: "操作を実行するには、項目を選択してください。",
  unknownAction: "不明な操作です。",
  // forms
  save: "保存", saveAndAddAnother: "保存してもう一つ追加", saveAndContinue: "保存して編集を続ける",
  required: "このフィールドは必須です。", invalidNumber: "数値を入力してください。",
  invalidInteger: "整数を入力してください。", invalidDate: "正しい日時を入力してください。",
  invalidJson: "JSON が不正です。", invalidChoice: "正しい選択肢を選んでください。",
  invalidValue: "値が不正です。", formHasErrors: "下記のエラーを修正してください。",
  fkTooMany: "選択肢が多いため ID を直接入力してください。", openRelated: "一覧を開く",
  // results (flash)
  added: (s: string) => `「${s}」を追加しました。`, changed: (s: string) => `「${s}」を変更しました。`,
  deleted: (s: string) => `「${s}」を削除しました。`, deletedMany: (n: number) => `${n} 件削除しました。`,
  alreadyDeleted: (s: string) => `「${s}」は既に削除されています。`,   // warning, decision 036
  actionDone: "操作を実行しました。", afterSaveFailed: "保存しましたが、保存後の処理でエラーが発生しました。",
  // errors
  dbUnique: "同じ値のデータが既に存在します。", dbForeignKey: "関連するデータがあるため処理できません。",
  dbNotNull: "必須の値が不足しています。", dbOther: "データベースエラーが発生しました。",
  hookFailed: "処理中にエラーが発生しました。", actionFailed: "操作の実行中にエラーが発生しました。",
  confirmDelete: (s: string) => `「${s}」を削除してもよろしいですか?`,
  confirmAction: (label: string) => `「${label}」を実行してもよろしいですか?`,
  confirmYes: "はい、実行します", cancel: "キャンセル",
  // auth / errors pages
  login: "ログイン", username: "ユーザー名", password: "パスワード",
  loginFailed: "ユーザー名またはパスワードが正しくありません。",
  forbidden: "権限がありません。", notFound: "ページが見つかりません。",
  unauthorized: "ログインが必要です。", serverError: "サーバーエラーが発生しました。",
  csrfFailed: "不正なリクエストです (CSRF)。",
} as const;
```
The wording above is the default. Implementers may refine strings, but keys are referenced by other components and tests import `messages` instead of hard-coding text.

### `src/time.ts`
Changed 2026-10-07: date-only functions work on UTC-midnight calendar dates and take no time zone; `formatDate` and `calendarPresetRange` added (decision 019).
Changed 2026-10-07: `parseDateOnly` format made explicit; it also validates date-only strings, and `toDateOnly` turns `calendarPresetRange` bounds into string bounds for them (decision 023).
Changed 2026-10-07: `zonedToInstant` algorithm corrected to the candidate/round-trip method; the previous text contradicted its own gap/overlap outcomes (decision 025).

```ts
export type DatePreset = "today" | "past7" | "month" | "year";
export function resolveTimeZone(tz?: string): string;
  // undefined → Intl.DateTimeFormat().resolvedOptions().timeZone; invalid → throws
  // Error("drizzle-admin: invalid timeZone \"<tz>\"")
export function zonedParts(instant: Date, tz: string): { y: number; mo: number; d: number; h: number; mi: number; s: number };
  // Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year/month/day/hour/minute/second numeric }).formatToParts
export function zonedToInstant(p: { y: number; mo: number; d: number; h?: number; mi?: number; s?: number }, tz: string): Date;
  // h/mi/s default to 0. guess = the wall-clock parts read as UTC (ms; set the full year with
  // setUTCFullYear so years 0-99 are not mapped to 19xx). offset(x) = (zonedParts(x, tz) read as
  // UTC) - x, i.e. the zone's UTC offset in force at instant x.
  // candidates = distinct values of { guess - offset(guess - 1 day), guess - offset(guess + 1 day) }
  //   (the offsets on either side of any nearby transition).
  // valid = candidates c whose zonedParts(c, tz), read as UTC, equal guess (they round-trip).
  // result = valid non-empty ? min(valid)       // overlap → the first occurrence
  //                          : max(candidates); // gap → the later valid instant (the wall time
  //                                             //   shifted forward by the gap length)
  // Examples: New York 2026-03-08 02:30 (gap) → 07:30Z (03:30 EDT); New York 2026-11-01 01:30
  // (overlap) → 05:30Z (EDT); Berlin 2026-03-29 02:30 (gap) → 01:30Z (03:30 CEST); Berlin
  // 2026-10-25 02:30 (overlap) → 00:30Z (CEST).
  // Do not use the single-pass correction "offset1 = offset(guess); result = guess -
  // offset(guess - offset1)": it gives 06:30Z (01:30 EST) for the New York gap and 01:30Z (the
  // second occurrence) for the Berlin overlap (decision 025).
export function parseDatetimeLocal(value: string, tz: string): Date | null;  // "YYYY-MM-DDTHH:mm[:ss]"
export function parseDateOnly(value: string): Date | null;                   // "YYYY-MM-DD" → new Date(Date.UTC(y, m-1, d)); no tz
  // accepts only /^(\d{4})-(\d{2})-(\d{2})$/ with a real calendar date; forms also use it to validate
  // date-only strings (PG date() string mode) and keep the string, not the Date (decision 023)
export function toDatetimeLocal(instant: Date, tz: string): string;          // "YYYY-MM-DDTHH:mm"
export function toDateOnly(date: Date): string;                              // "YYYY-MM-DD" from UTC parts; no tz
  // also used by data to turn calendarPresetRange bounds into string bounds for date-only strings
export function formatDateTime(instant: Date, tz: string): string;           // "2026/10/07 14:05" (ja-JP, 2-digit fields)
export function formatDate(date: Date): string;                              // "2026/10/07" from UTC parts; for date-only values
export function datePresetRange(p: DatePreset, now: Date, tz: string): { start: Date; end: Date };
  // instants: local midnights in tz (timestamp fields)
export function calendarPresetRange(p: DatePreset, now: Date, tz: string): { start: Date; end: Date };
  // date-only fields: "today" = calendar date of `now` in tz (zonedParts); boundaries are the same
  // calendar dates as datePresetRange, returned as UTC midnights (Date.UTC; month/day overflow
  // handled by Date.UTC). Example: now = 2026-10-06T16:00Z, tz Asia/Tokyo → today = 2026-10-07 →
  // { start: 2026-10-07T00:00Z, end: 2026-10-08T00:00Z }.
```
`parse*` return `null` for malformed input or impossible dates (e.g. month 13, Feb 30: re-derive the parts and compare).
`datePresetRange` and `calendarPresetRange` ranges are half-open `[start, end)`; see decision 009 for the definitions.
Date-only values (PG `date({mode:"date"})`) are Dates at UTC midnight, because drizzle writes them with `toISOString()` and reads `YYYY-MM-DD` as UTC midnight (evidence: 2026-10-07-drizzle-pg-date-mapping). They are never converted with `tz`. Date-only strings (PG `date()` string mode) stay `YYYY-MM-DD` strings; only the filter bounds pass through these functions (decision 023). No function here uses local-time Date methods (`getDate`, `getHours`, `new Date(y, m, d)`, ...), so results do not depend on the process time zone (decision 019).

## Data formats
- `datetime-local` value format: `YYYY-MM-DDTHH:mm` (seconds optional on input, omitted on output).

## Errors
- Only `resolveTimeZone` throws. All parsers return `null`.
