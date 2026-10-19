declare const Deno: { env: { get(name: string): string | undefined } };
export function configuration() {
  
  return {
    url: Deno.env.get("SUPABASE_URL"),
    key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
export function configured() {
  const c = configuration();
  return !!(c.url && c.key);
}
export async function database<T = import("../lib/model").Row>(
  path: string,
  init: RequestInit = {},
): Promise<T[]> {
  const { url, key } = configuration();
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
    throw new Error("Supabase URLの設定が正しくありません");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", "return=representation");
  if (!key.startsWith("sb_secret_"))
    headers.set("Authorization", `Bearer ${key}`);
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Supabase request failed", response.status);
    throw new Error(
      response.status === 409
        ? "同じ商品コード・顧客番号の登録、または請求済みの伝票があります。再読み込みして確認してください。"
        : "データベースとの通信に失敗しました。接続設定とテーブルを確認してください。",
    );
  }
  return response.status === 204 ? [] : ((await response.json()) as T[]);
}
