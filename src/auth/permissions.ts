import type { AdminUser, ResolvedModel } from "../types.js";

export type Perm = "view" | "add" | "change" | "delete";

export function can(model: ResolvedModel, perm: Perm, user: AdminUser): boolean {
  return model.permissions[perm](user);
}

/** True when the user holds at least one permission; otherwise the model is hidden (decision 043). */
export function canAny(model: ResolvedModel, user: AdminUser): boolean {
  return (["view", "add", "change", "delete"] as const).some((perm) => can(model, perm, user));
}

// Custom actions require "change" (decision 016); the built-in delete_selected uses "delete".
export const ACTION_PERMISSION: Perm = "change";
