import assert from "node:assert/strict";
import {
  orderTotals,
  unitPrice,
  monthlyDocument,
  documentTotal,
  orderSchema,
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
