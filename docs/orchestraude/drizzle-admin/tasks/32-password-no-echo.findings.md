# Review findings

high: 0, medium: 0, low: 2

## high


## medium


## low

- [security] FK auto-link on a masked list cell exposes the value in its href
  - location: src/routes/list.ts:171
  - detail: If an operator puts the password widget on an FK column (fields.ts allows any widget override on an FK), the masked cell still gets the FK auto-link `${prefix}/${refSlug}/${enc(value)}/change/`. That puts the raw value in the HTML. The link is also left out when the value is null, which shows whether the value is set; decision 037 point 5 says neither should be shown. This is an unrealistic configuration, which is why it is low. Fix: skip the FK auto-link when the column is masked, for example add `!masked` to the condition, or compute `masked` once and reuse it.
  - evidence: (none)
- [security] Sorting by a masked list column still reveals whether the value is set
  - location: src/routes/list.ts:186
  - detail: A password column in listDisplay is still sortable with `?o=`. Ordering by it groups NULL rows apart from set rows and orders rows by the stored value or hash. A user with view permission can therefore tell which rows have a value set, which decision 037 point 5 says the mask should hide. The impact is small, since the ordering of hashes is not useful. One option is to make password-widget columns non-sortable; another is to record this as accepted behavior.
  - evidence: (none)

