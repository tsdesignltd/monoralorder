import {
  emptyCompany,
  emptyCustomer,
  emptyProduct,
  today,
  type Row,
} from "./model";
export function demoRecords(): Row[] {
  const make = (
    kind: Row["kind"],
    data: Row["data"],
    seq: number,
    id = crypto.randomUUID(),
  ): Row => ({
    id,
    seq,
    kind,
    data,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const a = make(
    "customer",
    {
      ...emptyCustomer,
      name: "サンプルアウトドア株式会社",
      contact: "山田",
      address: "東京都サンプル区1-2-3",
      email: "demo@example.com",
    },
    1,
  );
  const b = make(
    "customer",
    {
      ...emptyCustomer,
      name: "サンプル・キャンプストア",
      address: "大阪府サンプル市4-5-6",
    },
    2,
  );
  const p = make(
    "product",
    { ...emptyProduct, name: "デモ商品 A", sku: "DEMO-001", price: 24000 },
    3,
  );
  const q = make(
    "product",
    { ...emptyProduct, name: "デモ商品 B", sku: "DEMO-002", price: 5800 },
    4,
  );
  return [
    a,
    b,
    p,
    q,
    make(
      "company",
      {
        ...emptyCompany,
        name: "MONORAL（デモ）",
        address: "東京都サンプル区0-0-0",
        bank: "デモ銀行　サンプル支店　普通 0000000",
      },
      5,
    ),
    make(
      "order",
      {
        customerId: a.id,
        title: "秋の展示用サンプル",
        date: today(),
        deliveryDate: "",
        dueDate: "",
        status: "受注確定",
        businessType: "卸販売",
        wholesaleRate: 65,
        note: "これは操作確認用の架空データです。",
        items: [
          {
            productId: p.id,
            name: "デモ商品 A",
            sku: "DEMO-001",
            qty: 3,
            unit: "個",
            price: 24000,
            tax: 10,
          },
          {
            productId: q.id,
            name: "デモ商品 B",
            sku: "DEMO-002",
            qty: 5,
            unit: "個",
            price: 5800,
            tax: 10,
          },
        ],
      },
      6,
    ),
    make(
      "order",
      {
        customerId: b.id,
        title: "追加ご注文",
        date: today(),
        deliveryDate: "",
        dueDate: "",
        status: "見積中",
        businessType: "サンプル販売",
        wholesaleRate: 80,
        note: "",
        items: [
          {
            productId: p.id,
            name: "デモ商品 A",
            sku: "DEMO-001",
            qty: 2,
            unit: "個",
            price: 24000,
            tax: 10,
          },
        ],
      },
      7,
    ),
  ];
}
