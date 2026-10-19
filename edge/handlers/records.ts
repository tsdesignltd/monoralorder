import { requireUser, allowedOrigin } from "../security";
import { configured, database } from "../database";
import {
  documentTypes,
  monthlyDocument,
  companySchema,
  customerSchema,
  productSchema,
  orderSchema,
  snapshotOrder,
  number,
  type Row,
  type Order,
  type Customer,
  type Company,
} from "../../lib/model";
import { z } from "zod";
export const dynamic = "force-dynamic";
const response = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return response({ error: "ログインしてください" }, 401);
  if (!configured()) return response({ configured: false, records: [] });
  try {
    const records: Row[] = [];
    for (let offset = 0; offset < 100000; offset += 1000) {
      const batch = await database(
        `monoral_records?owner_id=eq.${encodeURIComponent(user.userId)}&order=seq.desc&limit=1000&offset=${offset}`,
      );
      records.push(...batch);
      if (batch.length < 1000) return response({ configured: true, records });
    }
    return response(
      { error: "件数上限を超えました。絞り込みの追加が必要です。" },
      422,
    );
  } catch (e) {
    return response({ error: (e as Error).message }, 503);
  }
}
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return response({ error: "ログインしてください" }, 401);
  const origin = req.headers.get("origin");
  if (!allowedOrigin(origin))
    return response({ error: "不正な送信元です" }, 403);
  if (!configured())
    return response({ error: "Supabaseの接続設定が必要です" }, 503);
  try {
    const raw = await req.text();
    if (raw.length > 200000)
      return response({ error: "データが大きすぎます" }, 413);
    const body = z
      .object({
        kind: z.enum(["customer", "product", "order", "company", "document"]),
        id: z.string().uuid().optional(),
        version: z.number().int().positive().optional(),
        data: z.unknown(),
      })
      .parse(JSON.parse(raw));
    let data: unknown;
    const scope = `owner_id=eq.${encodeURIComponent(user.userId)}`;
    if (body.kind === "document") {
      if (body.id)
        return response({ error: "発行済み帳票は変更できません" }, 400);
      const input = z
        .object({
          orderId: z.string().uuid(),
          type: z.enum(["見積書", "納品書", "請求書", "納品請求書"]),
        })
        .parse(body.data);
      const orders: Row<Order>[] = await database<Row<Order>>(
        `monoral_records?${scope}&kind=eq.order&id=eq.${input.orderId}`,
      );
      if (!orders[0]) return response({ error: "受注が見つかりません" }, 404);
      const order = orders[0];
      const customers: Row<Customer>[] = await database<Row<Customer>>(
        `monoral_records?${scope}&kind=eq.customer&id=eq.${order.data.customerId}`,
      );
      const companies: Row<Company>[] = await database<Row<Company>>(
        `monoral_records?${scope}&kind=eq.company&limit=1`,
      );
      if (!customers[0] || !companies[0]?.data.address)
        return response(
          { error: "顧客と自社情報（住所を含む）を登録してください" },
          400,
        );
      if (
        input.type.includes("請求") &&
        ["見積中", "キャンセル"].includes(order.data.status)
      )
        return response({ error: "受注を確定してから請求してください" }, 400);
      data = {
        type: input.type,
        date: new Date().toLocaleDateString("sv-SE", {
          timeZone: "Asia/Tokyo",
        }),
        orderId: order.id,
        orderNumber: number(order),
        customer: customers[0].data,
        company: companies[0].data,
        order: snapshotOrder(order.data),
      };
      if (input.type.includes("請求")) {
        const result = await database("rpc/monoral_issue_document", {
          method: "POST",
          body: JSON.stringify({
            p_owner: user.userId,
            p_data: data,
            p_order_ids: [order.id],
          }),
        });
        return response({ record: result[0] });
      }
    } else {
      const schema = {
        customer: customerSchema,
        product: productSchema,
        order: orderSchema,
        company: companySchema,
      }[body.kind];
      data = schema.parse(body.data);
      if (body.kind === "order") {
        const found = await database(
          `monoral_records?${scope}&kind=eq.customer&id=eq.${(data as Order).customerId}&select=id`,
        );
        if (!found.length)
          return response({ error: "顧客が見つかりません" }, 400);
      }
    }
    let rows;
    if (body.id) {
      if (!body.version) return response({ error: "更新番号が必要です" }, 400);
      rows = await database(
        `monoral_records?${scope}&kind=eq.${body.kind}&id=eq.${body.id}&version=eq.${body.version}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            data,
            version: body.version + 1,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!rows.length)
        return response(
          { error: "他の端末で更新されています。再読み込みしてください。" },
          409,
        );
    } else
      rows = await database("monoral_records", {
        method: "POST",
        body: JSON.stringify({ owner_id: user.userId, kind: body.kind, data }),
      });
    return response({ record: rows[0] });
  } catch (e) {
    if (e instanceof z.ZodError)
      return response(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("\n"),
        },
        400,
      );
    if (e instanceof SyntaxError)
      return response({ error: "入力形式が正しくありません" }, 400);
    return response({ error: (e as Error).message }, 500);
  }
}
