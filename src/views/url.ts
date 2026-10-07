// List-page URL building. The query string carries q, p, o and f_<key>; links change one thing at a
// time and keep the rest.

export type SortState = "asc" | "desc" | "none";

export function withQuery(
  base: string,
  current: URLSearchParams,
  changes: Record<string, string | null>,
): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  // Changing search, filter or ordering must not keep a stale page number (decision 013 item 6).
  if (!Object.hasOwn(changes, "p")) params.delete("p");
  const query = params.toString();
  return query === "" ? base : `${base}?${query}`;
}

/**
 * Header link for `key` given its current sort state: none -> `o=key` -> `o=-key` -> no `o`
 * (decision 013 item 5). Replacing `o` drops any other sort keys; `p` is dropped by withQuery.
 */
export function sortHref(
  base: string,
  current: URLSearchParams,
  key: string,
  state: SortState,
): string {
  const next = state === "none" ? key : state === "asc" ? `-${key}` : null;
  return withQuery(base, current, { o: next });
}
