import { getChatGPTUser } from "../../chatgpt-auth";
import { database, configured } from "../../../lib/supabase";
import { parseCustomerImport } from "../../../lib/customer-import";
export async function POST(req: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインしてください" }, { status: 401 });
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "不正な送信元です" }, { status: 403 });
  if (!configured())
    return Response.json(
      { error: "Supabaseを接続してください" },
      { status: 503 },
    );
  try {
    const text = await req.text();
    if (text.length > 2000000) throw new Error("ファイルが大きすぎます");
    const customers = parseCustomerImport(JSON.parse(text));
    const result = await database("rpc/monoral_import_customers", {
      method: "POST",
      body: JSON.stringify({ p_owner: user.userId, p_customers: customers }),
    });
    return Response.json({ records: result });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
