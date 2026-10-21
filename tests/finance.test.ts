import assert from "node:assert/strict";
import {
  productCategory,
  productInCategory,
  productSchema,
  emptyProduct,
  singleDocument,
  documentDeliveryRecipient,
  orderPartySchema,
  periodDeliveries,
  periodInvoiceDocument,
  periodInvoiceRequest,
  orderTotals,
  customerCategory,
  customerSchema,
  unitPrice,
  monthlyDocument,
  documentTotal,
  documentTotals,
  orderSchema,
  snapshotOrder,
  emptyCompany,
  emptyCustomer,
  type Order,
  type Row,
} from "../lib/model";
const base: Order = {
  customerId: "11111111-1111-4111-8111-111111111111",
  title: "Test",
  date: "2026-10-01",
  deliveryDate: "",
  dueDate: "",
  status: "受注確定",
  businessType: "卸販売",
  wholesaleRate: 65,
  note: "",
  items: [
    {
      productId: "",
      name: "A",
      sku: "A",
      unit: "個",
      qty: 3,
      price: 24000,
      tax: 10,
    },
    {
      productId: "",
      name: "B",
      sku: "B",
      unit: "個",
      qty: 5,
      price: 5800,
      tax: 10,
    },
  ],
};
assert.equal(orderTotals(base).total, 72215);
// Persisted delivery details must survive later catalog and order edits.
{
  const catalog = { name: "旧商品名", sku: "OLD", price: 10000, unit: "個", tax: 10 as const };
  const savedOrder = orderSchema.parse({ ...base, items: [{ ...catalog, productId: "product-1", qty: 2 }] });
  const delivery = snapshotOrder(savedOrder);
  const before = JSON.stringify(delivery);
  const total = orderTotals(delivery).total;
  Object.assign(catalog, { name: "新商品名", sku: "NEW", price: 20000, unit: "箱", tax: 8 });
  assert.equal(savedOrder.items[0].name, "旧商品名");
  assert.equal(savedOrder.items[0].price, 10000);
  savedOrder.items[0].name = "受注訂正";
  savedOrder.items[0].qty = 5;
  savedOrder.items[0].price = 30000;
  savedOrder.wholesaleRate = 80;
  assert.equal(JSON.stringify(delivery), before);
  assert.equal(orderTotals(delivery).total, total);
}
assert.equal(orderTotals({ ...base, businessType: "返品処理" }).total, -72215);
assert.equal(unitPrice(1001, 65), 650);
assert.equal(unitPrice(12345, 65.25), 8055);
assert.equal(orderTotals({ ...base, wholesaleRate: 0 }).total, 0);
assert.equal(
  orderSchema.safeParse({ ...base, wholesaleRate: 101 }).success,
  false,
);
assert.equal(orderSchema.safeParse({ ...base, items: [] }).success, false);
assert.equal(
  orderSchema.safeParse({ ...base, date: "2026-02-30" }).success,
  false,
);
const row = (data: Order, n: number): Row<Order> => ({
  id: crypto.randomUUID(),
  kind: "order",
  data,
  seq: n,
  version: 1,
  created_at: "",
  updated_at: "",
});
const monthly = monthlyDocument(
  [
    row(base, 1),
    row({ ...base, businessType: "返品処理", items: [base.items[0]] }, 2),
  ],
  { ...emptyCustomer, name: "Test" },
  emptyCompany,
  "2026-10",
  10000,
  3000,
);
assert.equal(documentTotal(monthly), 27735);
assert.equal(monthly.monthly?.orders.length, 2);
const tiny = {
  ...base,
  wholesaleRate: 100,
  items: [{ ...base.items[0], qty: 1, price: 5 }],
};
const aggregated = monthlyDocument(
  [row(tiny, 1), row(tiny, 2)],
  { ...emptyCustomer, name: "Test" },
  emptyCompany,
  "2026-10",
);
assert.equal(
  documentTotal(aggregated),
  11,
  "monthly tax rounds once per tax rate",
);
console.log(
  "PASS: wholesale rates, return signs, validation, monthly balances, monthly tax rounding",
);

// 新しい業務区分と既存の卸販売をどちらも保存でき、卸の計算は同じ。
for (const businessType of ["アウトドア卸売", "バイク卸売", "サンプル販売", "保証交換", "返品処理", "卸販売"] as const) {
  const parsed = orderSchema.parse({ ...base, businessType });
  assert.equal(parsed.businessType, businessType);
  assert.equal(orderTotals(parsed).total, orderTotals(base).total * (businessType === "返品処理" ? -1 : 1));
}
assert.equal(orderSchema.safeParse({ ...base, businessType: "未定義" }).success, false);

assert.equal(customerCategory("アウトドアショップ"), "アウトドア");
assert.equal(customerCategory("自転車店"), "バイク");
assert.equal(customerCategory("代理店"), "未分類");
assert.equal(customerCategory("その他"), "未分類");
for (const category of ["アウトドア", "バイク", "アウトドアショップ", "自転車店", "代理店", "その他"]) {
  assert.equal(customerSchema.parse({ ...emptyCustomer, name: "分類テスト", category }).category, category);
}

const importedCommon = { note: "分類: バイク\nJAN: 123\n分類: アウトドア・バイク共通" };
assert.equal(productCategory(importedCommon), "共通");
assert.equal(productInCategory(importedCommon, "アウトドア"), true);
assert.equal(productInCategory(importedCommon, "バイク"), true);
assert.equal(productInCategory(importedCommon, "未分類"), false);
assert.equal(productCategory({ note: "分類: アウトドア" }), "アウトドア");
assert.equal(productCategory({ note: "分類: バイク" }), "バイク");
assert.equal(productCategory({ note: "バイクにも使える商品" }), "未分類");
assert.equal(productCategory({ category: "アウトドア", note: "分類: バイク" }), "アウトドア");
assert.equal(productInCategory({ note: "" }, "すべて"), true);
assert.equal(productSchema.parse({ ...emptyProduct, sku: "TEST", name: "分類確認", category: "共通" }).category, "共通");
assert.equal(productSchema.safeParse({ ...emptyProduct, sku: "TEST", name: "分類確認", category: "不明" }).success, false);

const { status: previousStatus, ...withoutStatus } = base;
assert.equal(orderSchema.parse(withoutStatus).status, undefined);
assert.equal(orderSchema.parse({ ...base, status: "キャンセル" }).status, "キャンセル");
assert.equal(orderTotals(withoutStatus).total, orderTotals(base).total);

const shipParty = orderPartySchema.parse({ ...emptyCustomer, name: "納品先店舗", kana: "ノウヒンサキ", address: "東京都千代田区1-2-3", contact: "担当太郎", fax: "03-0000-0001" });
const billParty = { ...shipParty, name: "請求先本社", address: "大阪府大阪市4-5-6" };
const entry = row(orderSchema.parse({ ...withoutStatus, documentNumber: "962", estimateDate: "2026-10-01", deliveryIssuedDate: "2026-10-02", invoiceDate: "2026-10-03", receiptDate: "2026-10-04", customerDetails: shipParty, billingDetails: billParty, bankAccount: "伝票専用の振込先" }), 99);
const invoice = singleDocument(entry, "請求書", { ...emptyCustomer, name: "マスター顧客" }, emptyCompany);
assert.equal(invoice.date, "2026-10-03");
assert.equal(invoice.orderNumber, "962");
assert.equal(invoice.customer.name, "請求先本社");
assert.equal(invoice.company.bank, "伝票専用の振込先");
assert.equal(documentDeliveryRecipient(invoice)?.name, "納品先店舗");
assert.equal(invoice.order.receiptDate, "2026-10-04");
const deliveryDoc = singleDocument(entry, "納品書", emptyCustomer, emptyCompany);
assert.equal(deliveryDoc.date, "2026-10-02");
assert.equal(deliveryDoc.customer.name, "納品先店舗");
assert.equal(documentDeliveryRecipient(deliveryDoc), undefined);
assert.equal(singleDocument(entry, "見積書", emptyCustomer, emptyCompany).date, "2026-10-01");
assert.equal(singleDocument(entry, "納品請求書", emptyCustomer, emptyCompany).date, "2026-10-03");
entry.data.customerDetails!.name = "変更後";
entry.data.billingDetails!.name = "変更後請求先";
entry.data.bankAccount = "変更後口座";
assert.equal(invoice.customer.name, "請求先本社");
assert.equal(invoice.order.customerDetails!.name, "納品先店舗");
assert.equal(invoice.company.bank, "伝票専用の振込先");
assert.equal(orderSchema.safeParse({ ...base, estimateDate: "2026-02-30" }).success, false);
assert.equal(orderSchema.safeParse({ ...base, customerDetails: { ...shipParty, name: "" } }).success, false);
const oldDoc = singleDocument(row(base, 1), "請求書", { ...emptyCustomer, name: "旧顧客" }, { ...emptyCompany, bank: "既定口座" });
assert.equal(oldDoc.customer.name, "旧顧客");
assert.equal(oldDoc.company.bank, "既定口座");
console.log("PASS: order entry dates, separate billing recipient, account overrides and immutable snapshots");

const { title: previousTitle, ...withoutTitle } = withoutStatus;
assert.equal(orderSchema.parse(withoutTitle).title, "");
assert.equal(orderSchema.parse({ ...withoutStatus, title: "" }).title, "");
assert.equal(singleDocument(row(orderSchema.parse(withoutTitle), 2), "納品書", emptyCustomer, emptyCompany).order.title, "");

const firstDelivery = row({ ...base, date: "2026-09-01", deliveryIssuedDate: "2026-10-01", documentNumber: "DN-1" }, 101);
const lastDelivery = row({ ...base, date: "2026-09-02", deliveryIssuedDate: "2026-10-31" }, 102);
const plannedOnly = row({ ...base, deliveryDate: "2026-10-15" }, 103);
const outside = row({ ...base, deliveryIssuedDate: "2026-11-01" }, 104);
const cancelled = row({ ...base, deliveryIssuedDate: "2026-10-02", status: "キャンセル" }, 105);
const otherCustomer = row({ ...base, customerId: crypto.randomUUID(), deliveryIssuedDate: "2026-10-02" },106);
const recordedDelivery=row({...base,deliveryIssuedDate:""},107);
const deliveredDoc: Row<import("../lib/model").DocumentData>={...recordedDelivery,kind:"document",id:crypto.randomUUID(),data:singleDocument(recordedDelivery,"納品書",{...emptyCustomer,name:"期間集計テスト"},emptyCompany)};
deliveredDoc.data.date="2026-10-10";
const ds=periodDeliveries([firstDelivery,lastDelivery,plannedOnly,outside,cancelled,otherCustomer,recordedDelivery],[deliveredDoc],base.customerId,"2026-10-01","2026-10-31");
assert.deepEqual(ds.map(d=>d.order.id),[firstDelivery.id,recordedDelivery.id,lastDelivery.id]);
const periodBill=periodInvoiceDocument(ds.map(d=>d.order),{...emptyCustomer,name:"期間集計テスト"},emptyCompany,"2026-10-01","2026-10-31",ds);
assert.equal(periodBill.monthly!.startDate,"2026-10-01");
assert.equal(periodBill.monthly!.endDate,"2026-10-31");
assert.equal(periodBill.monthly!.orders[0].number,"DN-1");
assert.equal(documentTotal(periodBill),documentTotal(monthlyDocument(ds.map(d=>d.order),{...emptyCustomer,name:"期間集計テスト"},emptyCompany,"2026-10")));
const billedDoc={...deliveredDoc,id:crypto.randomUUID(),data:{...deliveredDoc.data,type:"請求書" as const,orderId:firstDelivery.id}};
assert.equal(periodDeliveries([firstDelivery],[billedDoc],base.customerId,"2026-10-01","2026-10-31")[0].excluded,"請求済み");
assert.equal(periodInvoiceRequest.safeParse({customerId:base.customerId,startDate:"2026-11-01",endDate:"2026-10-01",orderIds:[firstDelivery.id]}).success,false);
assert.equal(periodInvoiceRequest.safeParse({customerId:base.customerId,startDate:"2026-02-30",endDate:"2026-10-01",orderIds:[firstDelivery.id]}).success,false);
assert.equal(periodInvoiceRequest.parse({customerId:base.customerId,month:"2028-02",orderIds:[firstDelivery.id]}).endDate,"2028-02-29");
console.log("PASS: delivery periods include boundary dates, omit planned/cancelled/other customers and preserve billed exclusions");

const frameOrder={...base,wholesaleRate:75,items:[{...base.items[0],qty:1,price:260000}],shipping:0};
assert.equal(orderTotals(frameOrder).total,214500);
assert.equal(orderTotals({...frameOrder,wholesaleRate:80,items:[{...base.items[0],qty:1,price:360000}]}).total,316800);
assert.equal(orderTotals({...frameOrder,shipping:583}).total,215083);
assert.equal(orderTotals({...frameOrder,shipping:583}).tax,19500);
const pennyOrders=[1,2].map(n=>row({...base,wholesaleRate:100,shipping:0,deliveryIssuedDate:"2026-10-01",items:[{...base.items[0],qty:1,price:19}]},200+n));
const pennyDeliveries=periodDeliveries(pennyOrders,[],base.customerId,"2026-10-01","2026-10-31");
const pennyBill=periodInvoiceDocument(pennyOrders,emptyCustomer,emptyCompany,"2026-10-01","2026-10-31",pennyDeliveries);
assert.equal(documentTotals(pennyBill).tax,2);
assert.equal(documentTotal(pennyBill),40);
assert.equal(pennyBill.monthly!.orders.length,2);
assert.equal(pennyBill.monthly!.orders[0].order!.items[0].price,19);
pennyOrders[0].data.items[0].price=99;
assert.equal(pennyBill.monthly!.orders[0].order!.items[0].price,19);
console.log("PASS: reference document amounts, shipping as tax-inclusive charge, and sums of per-delivery rounded taxes");
