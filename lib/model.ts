import { z } from "zod";
const text = z.string().trim().max(2000),
  required = z.string().trim().min(1, "必須項目を入力してください").max(200);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
const optionalDate = z.union([date, z.literal("")]);
export const categories = ["アウトドア", "バイク"] as const;
const legacyCategories = ["アウトドアショップ", "自転車店", "代理店", "その他"] as const;
export function customerCategory(category: string): "アウトドア" | "バイク" | "未分類" {
  if (category === "アウトドア" || category === "アウトドアショップ") return "アウトドア";
  if (category === "バイク" || category === "自転車店") return "バイク";
  return "未分類";
}
export const businessTypes = ["アウトドア卸売", "バイク卸売", "サンプル販売", "保証交換", "返品処理"] as const;
export const documentTypes = [
  "見積書",
  "納品書",
  "請求書",
  "納品請求書",
  "合計請求書",
] as const;
export const customerSchema = z.object({
  name: required,
  contact: text,
  address: text,
  postal: text,
  email: text,
  phone: text,
  note: text,
  category: z.union([z.enum(categories), z.enum(legacyCategories)]),
  legacyId: text.default(""),
  fax: text.default(""),
});
export const productCategories = ["アウトドア", "バイク", "共通", "未分類"] as const;
export const productSchema = z.object({
  name: required,
  sku: required,
  category: z.enum(productCategories).optional(),
  price: z.number().int().min(0).max(100000000),
  unit: required,
  tax: z.union([z.literal(0), z.literal(8), z.literal(10)]),
  note: text,
});
// 取り込み済み商品は備考の分類を利用し、編集後は専用フィールドを優先する。
export function productCategory(product: Pick<Product, "category" | "note">): (typeof productCategories)[number] {
  if (product.category) return product.category;
  const labels = product.note.split(/\r?\n/).filter((line) => /^分類\s*[:：]/.test(line));
  const outdoor = labels.some((line) => line.includes("アウトドア"));
  const bike = labels.some((line) => line.includes("バイク"));
  return outdoor && bike ? "共通" : outdoor ? "アウトドア" : bike ? "バイク" : "未分類";
}
export function productInCategory(product: Pick<Product, "category" | "note">, category: string): boolean {
  const actual = productCategory(product);
  return category === "すべて" || actual === category ||
    (actual === "共通" && (category === "アウトドア" || category === "バイク"));
}
export const lineSchema = z.object({
  productId: z.string(),
  name: required,
  sku: text,
  qty: z.number().int().min(1).max(10000),
  unit: required,
  price: z.number().int().min(0).max(100000000),
  tax: z.union([z.literal(0), z.literal(8), z.literal(10)]),
});
export const orderPartySchema = z.object({
  name: required,
  kana: text.default(""),
  contact: text,
  address: text,
  postal: text,
  phone: text,
  fax: text,
  email: text,
});
export type OrderParty = z.infer<typeof orderPartySchema>;
export const orderSchema = z.object({
  customerId: z.string().uuid(),
  documentNumber: z.string().trim().max(100).optional(),
  estimateDate: optionalDate.optional(),
  deliveryIssuedDate: optionalDate.optional(),
  invoiceDate: optionalDate.optional(),
  receiptDate: optionalDate.optional(),
  customerDetails: orderPartySchema.optional(),
  billingDetails: orderPartySchema.optional(),
  bankAccount: text.optional(),
  shipping: z.number().int().min(-100000000).max(100000000).optional(),
  dispatchDate: optionalDate.optional(),
  carrier: text.optional(),
  title: z.string().trim().max(200).default(""),
  date,
  deliveryDate: optionalDate,
  dueDate: optionalDate,
  // 旧データの状態は保持するが、新規受注では記録しない。
  status: z.enum(["見積中", "受注確定", "出荷済", "完了", "キャンセル"]).optional(),
  // 既存伝票・発行済み帳票の旧区分は引き続き読み書き可能にする。
  businessType: z.union([z.enum(businessTypes), z.literal("卸販売")]),
  wholesaleRate: z
    .number()
    .min(0)
    .max(100)
    .refine((v) => Number.isInteger(v * 100), "小数第2位まで指定してください"),
  note: text,
  items: z.array(lineSchema).min(1).max(100),
});
export const companySchema = z.object({
  name: required,
  fax: text.optional(),
  address: text,
  postal: text,
  phone: text,
  email: z.union([z.string().email(), z.literal("")]),
  registration: text,
  bank: text,
  note: text,
});
export type Customer = z.infer<typeof customerSchema>;
export type Product = z.infer<typeof productSchema>;
export type LegacySale = {legacyInvoiceNumber:string; legacyCustomerId:string; invoiceTotal:number; wholesaleSubtotal:number; retailSubtotal:number; tax:number; shipping:number|null; shippingLabel:string; deliveryDate:string; invoiceDate:string|null; estimateDate:string|null; paymentDate:string|null; items:{sku:string;name:string;quantity:number|null;unit:string;unitPrice:number;amount:number;description:string}[]; sourceFields:Record<string,string>};
export type Order = z.infer<typeof orderSchema> & {legacy?:LegacySale};
// Issued documents retain their own values; never resolve old lines from product IDs.
export function snapshotOrder(order: Order): Order {
  return structuredClone(order);
}
export type Company = z.infer<typeof companySchema>;
export type Line = z.infer<typeof lineSchema>;
export type AccountingTotals = { subtotal: number; tax: number; shipping: number; total: number; groups: {rate:number;subtotal:number;tax:number}[] };
export type DocumentData = {
  type: (typeof documentTypes)[number];
  date: string;
  orderId: string;
  orderNumber: string;
  customer: Customer;
  company: Company;
  order: Order;
  monthly?: {
    month: string;
    startDate?: string;
    endDate?: string;
    previousBalance: number;
    payment: number;
    accounting?: AccountingTotals;
    orders: {
      id: string;
      number: string;
      date: string;
      title: string;
      total: number;
      order?: Order;
    }[];
  };
};
// A document keeps the selected recipient, date and account as an immutable snapshot.
export function singleDocument(
  row: Row<Order>, type: DocumentData["type"], customer: Customer, company: Company,
): DocumentData {
  if (type === "合計請求書") throw new Error("合計請求書は月締めで作成してください");
  const order = snapshotOrder(row.data);
  const recipient = { ...customer, ...order.customerDetails };
  const billTo = type.includes("請求") && order.billingDetails;
  const issueDate = type === "見積書" ? order.estimateDate
    : type === "納品書" ? order.deliveryIssuedDate
    : order.invoiceDate || (type === "納品請求書" ? order.deliveryIssuedDate : "");
  return {
    type, date: issueDate || today(), orderId: row.id,
    orderNumber: order.documentNumber || number(row),
    customer: billTo ? { ...customer, ...billTo } : recipient,
    company: { ...company, bank: order.bankAccount ?? company.bank },
    order,
  };
}
export function documentDeliveryRecipient(d: DocumentData): OrderParty | undefined {
  return !d.monthly && d.type.includes("請求") && d.order.billingDetails
    ? d.order.customerDetails : undefined;
}
export type Kind = "customer" | "product" | "order" | "company" | "document";
export type Data = Customer | Product | Order | Company | DocumentData;
export type Row<T = Data> = {
  id: string;
  seq: number;
  kind: Kind;
  data: T;
  version: number;
  created_at: string;
  updated_at: string;
};
export const emptyCustomer: Customer = {
  name: "",
  contact: "",
  address: "",
  postal: "",
  email: "",
  phone: "",
  note: "",
  category: "その他",
  legacyId: "",
  fax: "",
};
export const emptyProduct: Product = {
  name: "",
  sku: "",
  price: 0,
  unit: "個",
  tax: 10,
  note: "",
};
export const emptyCompany: Company = {
  name: "MONORAL",
  address: "",
  postal: "",
  phone: "",
  email: "",
  registration: "",
  bank: "",
  note: "",
};
export const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
export const money = (v: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(v);
export function unitPrice(price: number, rate: number) {
  return Math.floor((price * Math.round(rate * 100)) / 10000);
}
export function pricedLines(order: Order): Line[] {
  return order.items.map((i) => ({
    ...i,
    price: unitPrice(i.price, order.wholesaleRate),
    qty: i.qty * (order.businessType === "返品処理" ? -1 : 1),
  }));
}
export function totals(items: Line[]) {
  const groups = [0, 8, 10]
    .map((rate) => {
      const subtotal = items
        .filter((i) => i.tax === rate)
        .reduce((s, i) => s + i.qty * i.price, 0);
      return { rate, subtotal, tax: Math.trunc((subtotal * rate) / 100) };
    })
    .filter((g) => g.subtotal !== 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0),
    tax = groups.reduce((s, g) => s + g.tax, 0);
  return { subtotal, tax, total: subtotal + tax, groups };
}
export const orderTotals = (order: Order): AccountingTotals => {
  if (order.legacy) return {subtotal:order.legacy.wholesaleSubtotal,tax:order.legacy.tax,shipping:order.legacy.shipping || 0,total:order.legacy.invoiceTotal,groups:[]};
  const result=totals(pricedLines(order));
  const shipping=order.shipping || 0;
  return {...result,shipping,total:result.total+shipping};
};
export function retailLines(order: Order): Line[] {
  return order.items.map(i=>({...i,qty:i.qty*(order.businessType==="返品処理" ? -1 : 1)}));
}
export const retailSubtotal = (order: Order) => retailLines(order).reduce((sum,i)=>sum+i.qty*i.price,0);
export const documentTotals = (d:DocumentData): AccountingTotals => d.monthly?.accounting || orderTotals(d.order);
export const documentTotal = (d: DocumentData) => documentTotals(d).total +
  (d.monthly ? d.monthly.previousBalance - d.monthly.payment : 0);
export function combinedOrderTotals(orders: Row<Order>[]): AccountingTotals {
  const all=orders.map(r=>orderTotals(r.data));
  const sum=(key:"subtotal"|"tax"|"shipping"|"total")=>all.reduce((v,t)=>v+t[key],0);
  const groups=[0,8,10].map(rate=>({rate,
    subtotal:all.flatMap(t=>t.groups).filter(g=>g.rate===rate).reduce((v,g)=>v+g.subtotal,0),
    tax:all.flatMap(t=>t.groups).filter(g=>g.rate===rate).reduce((v,g)=>v+g.tax,0),
  })).filter(g=>g.subtotal!==0 || g.tax!==0);
  return {subtotal:sum("subtotal"),tax:sum("tax"),shipping:sum("shipping"),total:sum("total"),groups};
}
export function number(row: Row) {
  if(row.kind === 'order' && (row.data as Order).legacy) return `旧伝票-${(row.data as Order).legacy!.legacyInvoiceNumber}`;
  const prefix =
    row.kind === "order"
      ? "OR"
      : row.kind === "document"
        ? {
            見積書: "QT",
            納品書: "DL",
            請求書: "IV",
            納品請求書: "DI",
            合計請求書: "MI",
          }[(row.data as DocumentData).type]
        : row.kind === "customer"
          ? "CU"
          : "PR";
  return `${prefix}-${String(row.seq).padStart(6, "0")}`;
}
export function monthlyDocument(
  orders: Row<Order>[],
  customer: Customer,
  company: Company,
  month: string,
  previousBalance = 0,
  payment = 0,
): DocumentData {
  if (!orders.length) throw new Error("対象の伝票がありません");
  return {
    type: "合計請求書",
    date: today(),
    orderId: "",
    orderNumber: month,
    customer,
    company,
    monthly: {
      month,
      previousBalance,
      payment,
      orders: orders.map((r) => ({
        id: r.id,
        number: number(r),
        date: r.data.deliveryDate || r.data.date,
        title: r.data.title,
        total: orderTotals(r.data).total,
      })),
    },
    order: {
      ...orders[0].data,
      title: `${month.replace("-", "年")}月分 合計請求`,
      date: today(),
      deliveryDate: "",
      dueDate: "",
      wholesaleRate: 100,
      businessType: "卸販売",
      shipping: orders.reduce((v,r)=>v+(r.data.shipping || 0),0),
      note: "月次の税額は対象伝票の税抜金額を税率ごとに合算して計算しています。",
      items: orders.flatMap((r) =>
        pricedLines(r.data).map((i) => ({
          ...i,
          name: `${number(r)} / ${i.name}`,
        })),
      ),
    },
  };
}

export function invoicePeriodLabel(d: DocumentData): string {
  return d.monthly?.startDate && d.monthly.endDate
    ? `${d.monthly.startDate} ～ ${d.monthly.endDate}` : d.monthly?.month || "";
}
export function periodDeliveries(orders: Row<Order>[], documents: Row<DocumentData>[], customerId: string, startDate: string, endDate: string) {
  const billed = new Set(documents.filter((d) => d.data.type.includes("請求")).flatMap((d) =>
    d.data.monthly ? d.data.monthly.orders.map((o) => o.id) : [d.data.orderId]));
  return orders.filter((o) => o.data.customerId === customerId && o.data.status !== "キャンセル").flatMap((order) => {
    const issued = documents.filter((d) => ["納品書", "納品請求書"].includes(d.data.type) && d.data.orderId === order.id)
      .map((d) => d.data.date).sort()[0];
    const deliveryDate = order.data.deliveryIssuedDate || issued || (order.data.legacy ? order.data.deliveryDate : "");
    if (!deliveryDate || !date.safeParse(deliveryDate).success || deliveryDate < startDate || deliveryDate > endDate) return [];
    return [{ order, date: deliveryDate, excluded: order.data.legacy ? "移行済（再請求対象外）" : billed.has(order.id) ? "請求済み" : "" }];
  }).sort((a,b) => a.date.localeCompare(b.date) || a.order.seq-b.order.seq);
}
export function periodInvoiceDocument(orders: Row<Order>[], customer: Customer, company: Company, startDate: string, endDate: string, deliveries: { order: Row<Order>; date: string }[], previousBalance=0, payment=0): DocumentData {
  if (!date.safeParse(startDate).success || !date.safeParse(endDate).success || startDate > endDate) throw new Error("対象期間を確認してください");
  if (orders.length > 500) throw new Error("対象伝票が500件を超えています。期間を分けてください");
  const result=monthlyDocument(orders,structuredClone(customer),structuredClone(company),startDate.slice(0,7),previousBalance,payment);
  result.monthly!.startDate=startDate;
  result.monthly!.endDate=endDate;
  result.orderNumber=`${startDate} ～ ${endDate}`;
  result.order.title="";
  result.order.documentNumber=undefined;
  result.order.customerDetails=undefined;
  result.order.billingDetails=undefined;
  result.order.bankAccount=undefined;
  result.order.shipping=0;
  result.monthly!.accounting=combinedOrderTotals(orders);
  result.order.note="各納品の仕切後金額・消費税・送料を合算しています。";
  result.monthly!.orders=orders.map((o)=>({id:o.id,number:o.data.documentNumber || number(o),date:deliveries.find(d=>d.order.id===o.id)!.date,title:o.data.businessType,total:orderTotals(o.data).total,order:snapshotOrder(o.data)}));
  return result;
}
export const periodInvoiceRequest = z.object({
  customerId: z.string().uuid(), startDate: date.optional(), endDate: date.optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  orderIds: z.array(z.string().uuid()).min(1).max(500),
  previousBalance: z.number().int().min(-100000000000).max(100000000000).default(0),
  payment: z.number().int().min(0).max(100000000000).default(0),
}).superRefine((v,ctx)=>{
  if (!(v.startDate && v.endDate) && !v.month) ctx.addIssue({code:z.ZodIssueCode.custom,message:"開始日と終了日を指定してください"});
  if (v.startDate && v.endDate && v.startDate > v.endDate) ctx.addIssue({code:z.ZodIssueCode.custom,message:"開始日は終了日以前にしてください"});
}).transform(v=>{
  const startDate=v.startDate || v.month+"-01";
  const endDate=v.endDate || new Date(Date.UTC(Number(v.month!.slice(0,4)),Number(v.month!.slice(5,7)),0)).toISOString().slice(0,10);
  return {...v,startDate,endDate};
});
