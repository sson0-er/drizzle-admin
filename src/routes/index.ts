import { Hono } from "hono";
import type { AdminState } from "../types.js";

/** Temporary stub without routes; task 14 replaces it with the real app (interfaces/routes.md). */
export function buildApp(_state: AdminState): Hono {
  return new Hono();
}
