import assert from "node:assert/strict";
import {
  productCategory,
  productInCategory,
  productSchema,
  emptyProduct,
  singleDocument,
  documentDeliveryRecipient,
  orderPartySchema,
  orderTotals,
  customerCategory,
  customerSchema,
  unitPrice,
  monthlyDocument,
  documentTotal,
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
