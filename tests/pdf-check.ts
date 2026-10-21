import fs from "node:fs";
import { createDocumentPdf as renderDocumentPdf } from "../lib/pdf";
import { demoRecords } from "../lib/demo";
import {
  singleDocument,
  orderPartySchema,
  periodInvoiceDocument,
  periodDeliveries,
  monthlyDocument,
  documentTypes,
  type Row,
  type Order,
  type Customer,
  type Company,
  type DocumentData,
} from "../lib/model";
const sealBytes = new Uint8Array(fs.readFileSync("public/brand/outdesign-seal.png"));
const createDocumentPdf = (row: Row<DocumentData>, font: Uint8Array, demo = false) =>
  renderDocumentPdf(row, font, demo, sealBytes);
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

const deliveredOrders=[{...order,data:{...order.data,deliveryIssuedDate:"2026-10-01",documentNumber:"DN-101"}},{...order,id:crypto.randomUUID(),seq:100,data:{...order.data,deliveryIssuedDate:"2026-10-31",documentNumber:"DN-102"}}];
const periodDs=periodDeliveries(deliveredOrders,[],order.data.customerId,"2026-10-01","2026-10-31");
const periodPdf=periodInvoiceDocument(deliveredOrders,customer.data,company.data,"2026-10-01","2026-10-31",periodDs);
fs.writeFileSync(".sites-runtime/pdf-qa/period-invoice.pdf",await createDocumentPdf({...order,kind:"document",data:periodPdf},new Uint8Array(fs.readFileSync("public/fonts/NotoSansJP.otf")),true));

const outdesign={...company.data,name:"アウトデザイン株式会社",postal:"194-0032",address:"東京都町田市本町田1833-4",phone:"042-703-4933",fax:"042-633-0363",registration:"T8012301011312",bank:"銀行名：きらぼし銀行　支店名：町田支店\n口座番号：普通口座 1892232\n口座名義：アウトデザイン（カ",note:"振込手数料は貴社でご負担願います。"};
const refOrder={...order,data:{...order.data,title:"",wholesaleRate:75,shipping:583,deliveryIssuedDate:"2026-10-01",documentNumber:"940",items:[{...order.data.items[0],sku:"MB-0027",name:"TA 2024 Tiフレーム Mサイズ",qty:1,price:260000}]}};
for(const [key,type] of [["reference-delivery","納品書"],["reference-invoice","請求書"]] as const){
 const data=singleDocument(refOrder,type,customer.data,outdesign);
 fs.writeFileSync(`.sites-runtime/pdf-qa/${key}.pdf`,await createDocumentPdf({...order,kind:"document",data},new Uint8Array(fs.readFileSync("public/fonts/NotoSansJP.otf")),true));
}
const refOrders=[refOrder,{...order,id:crypto.randomUUID(),seq:200,data:{...refOrder.data,documentNumber:"941",deliveryIssuedDate:"2026-10-17",wholesaleRate:80,shipping:0,items:[{...order.data.items[0],sku:"MB-0030",name:"ARフレームフォークセットM",qty:1,price:360000}]}}];
const refDs=periodDeliveries(refOrders,[],order.data.customerId,"2026-10-01","2026-10-31");
const refTotal=periodInvoiceDocument(refOrders,customer.data,outdesign,"2026-10-01","2026-10-31",refDs);
fs.writeFileSync(".sites-runtime/pdf-qa/reference-total.pdf",await createDocumentPdf({...order,kind:"document",data:refTotal},new Uint8Array(fs.readFileSync("public/fonts/NotoSansJP.otf")),true));
