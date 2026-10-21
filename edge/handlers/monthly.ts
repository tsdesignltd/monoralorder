import { requireUser, allowedOrigin } from "../security";
import { configured, database } from "../database";
import {
  periodInvoiceDocument,
  periodDeliveries,
  periodInvoiceRequest,
  type DocumentData,
  type Row,
  type Order,
  type Customer,
  type Company,
} from "../../lib/model";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user)
    return Response.json({ error: "ログインしてください" }, { status: 401 });
  if (!allowedOrigin(req.headers.get("origin")))
    return Response.json({ error: "不正な送信元です" }, { status: 403 });
  if (!configured())
    return Response.json(
      { error: "Supabaseの接続設定が必要です" },
      { status: 503 },
    );
  try {
    const body = periodInvoiceRequest.parse(await req.json());
    const scope = `owner_id=eq.${encodeURIComponent(user.userId)}`;
    async function allRecords<T>(query: string): Promise<Row<T>[]> {
      const result: Row<T>[]=[];
      for (let offset=0; offset<100000; offset+=1000) {
        const page=await database<Row<T>>(`monoral_records?${scope}&${query}&order=seq.asc&limit=1000&offset=${offset}`);
        result.push(...page);
        if (page.length<1000) return result;
      }
      throw new Error("対象データが多すぎます。管理者へご連絡ください");
    }
    const [candidateOrders,documents]=await Promise.all([
      allRecords<Order>(`kind=eq.order&data->>customerId=eq.${body.customerId}`),
      allRecords<DocumentData>("kind=eq.document"),
    ]);
    const deliveries=periodDeliveries(candidateOrders,documents,body.customerId,body.startDate,body.endDate);
    const orders=deliveries.filter(d=>!d.excluded).map(d=>d.order);
    const submitted=new Set(body.orderIds);
    if (submitted.size!==body.orderIds.length || orders.length!==submitted.size || orders.some(o=>!submitted.has(o.id))) {
      return Response.json({error:"期間内の納品または請求状況が変更されています。再読み込みして確認してください。"},{status:409});
    }
    const customers = await database<Row<Customer>>(
      `monoral_records?${scope}&kind=eq.customer&id=eq.${body.customerId}`,
    );
    const companies = await database<Row<Company>>(
      `monoral_records?${scope}&kind=eq.company&limit=1`,
    );
    if (!customers[0] || !companies[0]?.data.address)
      throw new Error("顧客と自社情報（住所を含む）を登録してください");
    const data = periodInvoiceDocument(
      orders,
      customers[0].data,
      companies[0].data,
      body.startDate,
      body.endDate,
      deliveries,
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
