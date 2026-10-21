import type { DocumentData } from "./model";

export function documentGreeting(type: DocumentData["type"]): string {
  const action = type.includes("請求") ? "請求" : type === "納品書" ? "納品" : "";
  return action ? `いつもお世話になっております。\n下記の通り${action}させていただきます。` : "";
}
