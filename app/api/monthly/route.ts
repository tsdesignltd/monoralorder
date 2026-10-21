import { getChatGPTUser } from "../../chatgpt-auth";
import { configured, database } from "../../../lib/supabase";
import {
  monthlyDocument,
  type Row,
  type Order,
  type Customer,
  type Company,
} from "../../../lib/model";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "ログインしてください" }, { status: 401 });
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "不正な送信元です" }, { status: 403 });
  if (!configured())
    return Response.json(
      { error: "Supabaseの接続設定が必要です" },
      { status: 503 },
    );
  try {
    const body = z
      .object({
        customerId: z.string().uuid(),
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        orderIds: z.array(z.string().uuid()).min(1).max(500),
        previousBalance: z.number().int().min(-100000000000).max(100000000000),
        payment: z.number().int().min(0).max(100000000000),
      })
      .parse(await req.json());
    const scope = `owner_id=eq.${encodeURIComponent(user.userId)}`;
    const orders = await database<Row<Order>>(
      `monoral_records?${scope}&kind=eq.order&id=in.(${body.orderIds.join(",")})&limit=500`,
    );
    if (
      orders.length !== new Set(body.orderIds).size ||
      orders.some(
        (r) =>
          r.data.customerId !== body.customerId ||
          !(r.data.deliveryDate || r.data.date).startsWith(body.month) ||
          r.data.status === "キャンセル",
      )
    )
      return Response.json(
        { error: "対象伝票が変更されています。再読み込みしてください。" },
        { status: 409 },
      );
    const customers = await database<Row<Customer>>(
      `monoral_records?${scope}&kind=eq.customer&id=eq.${body.customerId}`,
    );
    const companies = await database<Row<Company>>(
      `monoral_records?${scope}&kind=eq.company&limit=1`,
    );
    if (!customers[0] || !companies[0]?.data.address)
      throw new Error("顧客と自社情報（住所を含む）を登録してください");
    const data = monthlyDocument(
      orders,
      customers[0].data,
      companies[0].data,
      body.month,
      body.previousBalance,
      body.payment,
    );
    const records = await database("rpc/monoral_issue_document", {
      method: "POST",
      body: JSON.stringify({
        p_owner: user.userId,
        p_data: data,
        p_order_ids: orders.map((r) => r.id),
      }),
    });
    return Response.json({ record: records[0] });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "入力内容を確認してください"
            : (e as Error).message,
      },
      { status: 400 },
    );
  }
}
