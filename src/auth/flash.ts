// Flash message types shared with the views. addFlash / consumeFlash are added with the auth tasks.
export type FlashLevel = "success" | "warning" | "error";
export interface FlashMessage {
  level: FlashLevel;
  text: string;
}
export const FLASH_COOKIE = "da_flash";
