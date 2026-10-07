import type { AdminUser, ResolvedModel } from "../types.js";

export type Perm = "view" | "add" | "change" | "delete";

export function can(model: ResolvedModel, perm: Perm, user: AdminUser): boolean {
  return model.permissions[perm](user);
}

// Custom actions require "change" (decision 016); the built-in delete_selected uses "delete".
export const ACTION_PERMISSION: Perm = "change";
