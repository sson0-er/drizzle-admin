// All user-visible UI strings, once per locale. No other source file may contain UI text literals.
// Code takes them from the request's dictionary (`c.var.t` or a `t` argument), never from a module-level import.
const en = {
  defaultSiteTitle: "Site administration",
  // navigation / dashboard
  home: "Home",
  add: "Add",
  change: "Change",
  delete: "Delete",
  logout: "Log out",
  language: "Language",
  // list
  search: "Search",
  searchPlaceholder: "Search",
  filter: "Filter",
  all: "All",
  yes: "Yes",
  no: "No",
  today: "Today",
  past7: "Past 7 days",
  thisMonth: "This month",
  thisYear: "This year",
  action: "Action",
  run: "Go",
  selectAll: "Select all",
  deleteSelected: "Delete selected items",
  resultCount: (n: number) => (n === 1 ? "1 result" : `${n} results`),
  noSelection: "Items must be selected in order to perform actions on them.",
  unknownAction: "Unknown action.",
  tooManySelected: (max: number) => `At most ${max} items can be selected at once.`,
  // forms
  save: "Save",
  saveAndAddAnother: "Save and add another",
  saveAndContinue: "Save and continue editing",
  required: "This field is required.",
  invalidNumber: "Enter a number.",
  invalidInteger: "Enter a whole number.",
  invalidDate: "Enter a valid date/time.",
  invalidJson: "Enter valid JSON.",
  invalidChoice: "Select a valid choice.",
  invalidValue: "Enter a valid value.",
  formHasErrors: "Please correct the errors below.",
  fkTooMany: "There are too many choices; enter the ID directly.",
  openRelated: "Open list",
  // results (flash)
  added: (s: string) => `“${s}” was added.`,
  changed: (s: string) => `“${s}” was changed.`,
  deleted: (s: string) => `“${s}” was deleted.`,
  deletedMany: (n: number) => (n === 1 ? "Deleted 1 item." : `Deleted ${n} items.`),
  alreadyDeleted: (s: string) => `“${s}” has already been deleted.`,
  actionDone: "The action was performed.",
  afterSaveFailed: "Saved, but an error occurred after saving.",
  // errors
  dbUnique: "A record with the same value already exists.",
  dbForeignKey: "This could not be done because of related records.",
  dbNotNull: "A required value is missing.",
  dbOther: "A database error occurred.",
  hookFailed: "An error occurred while processing.",
  actionFailed: "An error occurred while performing the action.",
  confirmDelete: (s: string) => `Are you sure you want to delete “${s}”?`,
  confirmAction: (label: string) => `Are you sure you want to run “${label}”?`,
  confirmYes: "Yes, I'm sure",
  cancel: "Cancel",
  // auth / errors pages
  login: "Log in",
  username: "Username",
  password: "Password",
  loginFailed: "Please enter a correct username and password.",
  forbidden: "You do not have permission.",
  notFound: "Page not found.",
  unauthorized: "You need to log in.",
  serverError: "A server error occurred.",
  csrfFailed: "Invalid request (CSRF).",
  binary: "[binary]",
};

export type Messages = Readonly<typeof en>;

// Typed as Messages so a key missing from (or extra in) this dictionary fails the typecheck.
const ja: Messages = {
  defaultSiteTitle: "サイト管理",
  // navigation / dashboard
  home: "ホーム",
  add: "追加",
  change: "変更",
  delete: "削除",
  logout: "ログアウト",
  language: "言語",
  // list
  search: "検索",
  searchPlaceholder: "検索",
  filter: "フィルター",
  all: "すべて",
  yes: "はい",
  no: "いいえ",
  today: "今日",
  past7: "過去 7 日間",
  thisMonth: "今月",
  thisYear: "今年",
  action: "操作",
  run: "実行",
  selectAll: "すべて選択",
  deleteSelected: "選択された項目の削除",
  resultCount: (n: number) => `${n} 件`,
  noSelection: "操作を実行するには、項目を選択してください。",
  unknownAction: "不明な操作です。",
  tooManySelected: (max: number) => `一度に操作できるのは ${max} 件までです。`,
  // forms
  save: "保存",
  saveAndAddAnother: "保存してもう一つ追加",
  saveAndContinue: "保存して編集を続ける",
  required: "このフィールドは必須です。",
  invalidNumber: "数値を入力してください。",
  invalidInteger: "整数を入力してください。",
  invalidDate: "正しい日時を入力してください。",
  invalidJson: "JSON が不正です。",
  invalidChoice: "正しい選択肢を選んでください。",
  invalidValue: "値が不正です。",
  formHasErrors: "下記のエラーを修正してください。",
  fkTooMany: "選択肢が多いため ID を直接入力してください。",
  openRelated: "一覧を開く",
  // results (flash)
  added: (s: string) => `「${s}」を追加しました。`,
  changed: (s: string) => `「${s}」を変更しました。`,
  deleted: (s: string) => `「${s}」を削除しました。`,
  deletedMany: (n: number) => `${n} 件削除しました。`,
  alreadyDeleted: (s: string) => `「${s}」は既に削除されています。`,
  actionDone: "操作を実行しました。",
  afterSaveFailed: "保存しましたが、保存後の処理でエラーが発生しました。",
  // errors
  dbUnique: "同じ値のデータが既に存在します。",
  dbForeignKey: "関連するデータがあるため処理できません。",
  dbNotNull: "必須の値が不足しています。",
  dbOther: "データベースエラーが発生しました。",
  hookFailed: "処理中にエラーが発生しました。",
  actionFailed: "操作の実行中にエラーが発生しました。",
  confirmDelete: (s: string) => `「${s}」を削除してもよろしいですか?`,
  confirmAction: (label: string) => `「${label}」を実行してもよろしいですか?`,
  confirmYes: "はい、実行します",
  cancel: "キャンセル",
  // auth / errors pages
  login: "ログイン",
  username: "ユーザー名",
  password: "パスワード",
  loginFailed: "ユーザー名またはパスワードが正しくありません。",
  forbidden: "権限がありません。",
  notFound: "ページが見つかりません。",
  unauthorized: "ログインが必要です。",
  serverError: "サーバーエラーが発生しました。",
  csrfFailed: "不正なリクエストです (CSRF)。",
  binary: "[バイナリ]",
};

export type Locale = "en" | "ja";
// Switcher order.
export const LOCALES: readonly Locale[] = ["en", "ja"];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "ja";
}

export const MESSAGES: Readonly<Record<Locale, Messages>> = { en, ja };

// Endonyms: the switcher shows them unchanged in every locale.
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { en: "English", ja: "日本語" };
