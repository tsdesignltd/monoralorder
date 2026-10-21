import fs from "node:fs";
import { createDocumentPdf } from "../lib/pdf";
import { demoRecords } from "../lib/demo";
import {
  singleDocument,
  orderPartySchema,
  monthlyDocument,
  documentTypes,
  type Row,
  type Order,
  type Customer,
  type Company,
  type DocumentData,
} from "../lib/model";
const rows = demoRecords();
const order = rows.find((r) => r.kind === "order") as Row<Order>,
  customer = rows.find((r) => r.kind === "customer") as Row<Customer>,
  company = rows.find((r) => r.kind === "company") as Row<Company>;
fs.mkdirSync(".sites-runtime/pdf-qa", { recursive: true });
for (const type of documentTypes) {
  let data: DocumentData =
    type === "合計請求書"
      ? monthlyDocument(
          [order],
          customer.data,
          company.data,
          "2026-10",
          10000,
          3000,
        )
      : {
          type,
          date: "2026-10-19",
          orderId: order.id,
          orderNumber: "OR-000006",
          customer: customer.data,
          company: company.data,
          order: order.data,
        };
  const doc: Row<DocumentData> = { ...order, seq: 10, kind: "document", data };
  const result = await createDocumentPdf(
    doc,
    new Uint8Array(fs.readFileSync("public/fonts/NotoSansJP.otf")),
    true,
  );
  fs.writeFileSync(
    `.sites-runtime/pdf-qa/${documentTypes.indexOf(type)}.pdf`,
    result,
  );
}
const longOrder = {
  ...order.data,
  items: Array.from({ length: 60 }, (_, i) => ({
    ...order.data.items[i % 2],
    name: `${i + 1} / 長い商品名称と日本語の折り返し確認・アウトドア用品テスト`,
  })),
  note: "長い備考の改ページを検証します。\n".repeat(50),
};
const longDoc: Row<DocumentData> = {
  ...order,
  kind: "document",
  data: {
    type: "納品請求書",
    date: "2026-10-19",
    orderId: order.id,
    orderNumber: "OR-000006",
    customer: customer.data,
    company: company.data,
    order: longOrder,
  },
};
fs.writeFileSync(
  ".sites-runtime/pdf-qa/long.pdf",
  await createDocumentPdf(
    longDoc,
    new Uint8Array(fs.readFileSync("public/fonts/NotoSansJP.otf")),
    true,
  ),
);
console.log(
  "PDF fixtures generated: five document types and multipage fixture",
);

const entryDoc = singleDocument({ ...order, data: {
  ...order.data, documentNumber: "962", invoiceDate: "2026-10-19",
  customerDetails: orderPartySchema.parse({ ...customer.data, kana: "ノウヒンサキ", name: "納品先サンプル店舗" }),
  billingDetails: orderPartySchema.parse({ ...customer.data, name: "別請求先サンプル本社", address: "大阪府大阪市サンプル町4-5-6" }),
  bankAccount: "サンプル銀行 サンプル支店\n普通 1234567 カ）サンプル",
}}, "納品請求書", customer.data, company.data);
fs.writeFileSync(".sites-runtime/pdf-qa/order-entry.pdf", await createDocumentPdf(
  { ...order, kind: "document", data: entryDoc }, new Uint8Array(fs.readFileSync("public/fonts/NotoSansJP.otf")), true));
