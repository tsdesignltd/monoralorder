"use client";
import { useState, useEffect, type FormEvent } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Package,
  FileText,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ChevronRight,
  X,
  Printer,
  Download,
  RefreshCw,
  Check,
  Leaf,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import {
  categories,
  businessTypes,
  documentTypes,
  orderTotals,
  pricedLines,
  documentTotal,
  monthlyDocument,
  customerSchema,
  productSchema,
  orderSchema,
  companySchema,
  emptyCustomer,
  emptyProduct,
  emptyCompany,
  today,
  money,
  totals,
  number,
  type Row,
  type Kind,
  type Data,
  type Customer,
  type Product,
  type Order,
  type Company,
  type Line,
  type DocumentData,
} from "../lib/model";
import CustomerImporter from "./customer-importer";
import { demoRecords } from "../lib/demo";
type Page =
  "overview" | "order" | "customer" | "product" | "document" | "company";
const nav = [
  { id: "overview", label: "概要", icon: LayoutDashboard },
  { id: "order", label: "受注", icon: ShoppingBag },
  { id: "customer", label: "顧客", icon: Users },
  { id: "product", label: "商品", icon: Package },
  { id: "document", label: "帳票", icon: FileText },
  { id: "company", label: "自社情報", icon: Settings },
] as const;
const titles = {
  overview: ["Overview", "今日の仕事を、ここから。"],
  order: ["Orders", "受注管理"],
  customer: ["Customers", "顧客管理"],
  product: ["Products", "商品管理"],
  document: ["Documents", "帳票管理"],
  company: ["Company", "自社情報"],
};
const kinds = {
  customer: "顧客",
  product: "商品",
  order: "受注",
  company: "自社情報",
  document: "帳票",
};
const statuses = [
  "見積中",
  "受注確定",
  "出荷済",
  "完了",
  "キャンセル",
] as const;
export default function SalesApp({ userName }: { userName: string }) {
  const [page, setPage] = useState<Page>("overview"),
    [rows, setRows] = useState<Row[]>([]),
    [connected, setConnected] = useState(false),
    [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("すべて");
  const [monthly, setMonthly] = useState<{
    customerId: string;
    month: string;
    previousBalance: number;
    payment: number;
  } | null>(null);
  const [editing, setEditing] = useState<{
      kind: Kind;
      row?: Row;
      data: Data;
    } | null>(null),
    [preview, setPreview] = useState<Row<DocumentData> | null>(null);
  const customers = rows.filter(
      (r) => r.kind === "customer",
    ) as Row<Customer>[],
    products = rows.filter((r) => r.kind === "product") as Row<Product>[],
    orders = rows.filter((r) => r.kind === "order") as Row<Order>[],
    docs = rows.filter((r) => r.kind === "document") as Row<DocumentData>[];
  const company = rows.find((r) => r.kind === "company") as
    Row<Company> | undefined;
  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.data.name || "顧客未設定";
  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/records");
      const body = (await res.json()) as {
        error: string;
        configured: boolean;
        records: Row[];
      };
      if (!res.ok) throw new Error(body.error);
      setConnected(body.configured);
      setRows(body.records);
      setDemo(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  function go(p: Page) {
    setPage(p);
    setSearch("");
    setFilter("すべて");
  }
  function start(kind: Kind, row?: Row) {
    setError("");
    let data: Data = row
      ? structuredClone(row.data)
      : kind === "customer"
        ? { ...emptyCustomer }
        : kind === "product"
          ? { ...emptyProduct }
          : kind === "company"
            ? { ...emptyCompany }
            : {
                customerId: customers[0]?.id || "",
                title: "",
                date: today(),
                deliveryDate: "",
                dueDate: "",
                status: "見積中",
                businessType: "卸販売",
                wholesaleRate: 100,
                note: "",
                items: [],
              };
    setEditing({ kind, row, data });
  }
  async function persist(kind: Kind, data: unknown, row?: Row) {
    if (demo) {
      if (
        kind === "product" &&
        products.some(
          (p) => p.id !== row?.id && p.data.sku === (data as Product).sku,
        )
      )
        throw new Error("商品コードが重複しています");
      const record: Row = {
        id: row?.id || crypto.randomUUID(),
        seq: row?.seq || Math.max(0, ...rows.map((r) => r.seq)) + 1,
        kind,
        data: data as Data,
        version: (row?.version || 0) + 1,
        created_at: row?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setRows((old) => [record, ...old.filter((r) => r.id !== record.id)]);
      return record;
    }
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, data, id: row?.id, version: row?.version }),
    });
    const body = (await res.json()) as { error: string; record: Row };
    if (!res.ok) throw new Error(body.error);
    setRows((old) => [
      body.record,
      ...old.filter((r) => r.id !== body.record.id),
    ]);
    return body.record as Row;
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    try {
      const schema = {
        customer: customerSchema,
        product: productSchema,
        order: orderSchema,
        company: companySchema,
      }[editing.kind as Exclude<Kind, "document">];
      const result = schema.safeParse(editing.data);
      if (!result.success)
        throw new Error(result.error.issues.map((i) => i.message).join(" / "));
      await persist(editing.kind, result.data, editing.row);
      setEditing(null);
      setNotice(demo ? "デモ内で保存しました" : "保存しました");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function issue(order: Row<Order>, type: DocumentData["type"]) {
    if (busy) return;
    if (
      type.includes("請求") &&
      ["見積中", "キャンセル"].includes(order.data.status)
    ) {
      setError("受注を確定してから請求してください");
      return;
    }
    if (type.includes("請求") && billedIds.has(order.id)) {
      setError(
        "この受注は請求済みです。帳票一覧から再ダウンロードしてください。",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      let data: unknown = { orderId: order.id, type };
      if (demo) {
        if (!company?.data.address)
          throw new Error("自社情報の住所を登録してください");
        data = {
          type,
          date: today(),
          orderId: order.id,
          orderNumber: number(order),
          customer: customers.find((c) => c.id === order.data.customerId)!.data,
          company: company.data,
          order: structuredClone(order.data),
        };
      }
      const record = await persist("document", data);
      setPreview(record as Row<DocumentData>);
      setNotice(demo ? "デモ帳票を作成しました" : `${type}を発行しました`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(key: string, value: unknown) {
    setEditing((old) =>
      old ? { ...old, data: { ...old.data, [key]: value } as Data } : old,
    );
  }
  function lineUpdate(index: number, key: string, value: unknown) {
    if (!editing) return;
    const data = editing.data as Order;
    update(
      "items",
      data.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    );
  }
  function addLine(id: string) {
    const p = products.find((p) => p.id === id);
    const item: Line = p
      ? {
          productId: p.id,
          name: p.data.name,
          sku: p.data.sku,
          price: p.data.price,
          tax: p.data.tax,
          unit: p.data.unit,
          qty: 1,
        }
      : {
          productId: "",
          name: "",
          sku: "",
          price: 0,
          tax: 10,
          unit: "個",
          qty: 1,
        };
    update("items", [...(editing!.data as Order).items, item]);
  }
  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "monoral-sales-v1",
            exportedAt: new Date().toISOString(),
            demo,
            records: rows,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monoral-${demo ? "demo-" : ""}${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const matches = (r: Row) =>
    JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase()) ||
    number(r).toLowerCase().includes(search.toLowerCase());
  const visibleOrders = orders
    .filter(
      (r) =>
        matches(r) ||
        customerName(r.data.customerId)
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .filter((r) => filter === "すべて" || r.data.status === filter)
    .sort((a, b) => b.data.date.localeCompare(a.data.date) || b.seq - a.seq);
  const month = today().slice(0, 7),
    confirmed = orders.filter(
      (o) =>
        o.data.date.startsWith(month) &&
        ["受注確定", "出荷済", "完了"].includes(o.data.status),
    );
  const canEdit = connected || demo;
  const billedIds = new Set(
    docs
      .filter((d) => d.data.type.includes("請求"))
      .flatMap((d) =>
        d.data.monthly
          ? d.data.monthly.orders.map((o) => o.id)
          : [d.data.orderId],
      ),
  );
  const monthlyOrders = monthly
    ? orders.filter(
        (o) =>
          o.data.customerId === monthly.customerId &&
          (o.data.deliveryDate || o.data.date).startsWith(monthly.month) &&
          ["受注確定", "出荷済", "完了"].includes(o.data.status) &&
          !billedIds.has(o.id),
      )
    : [];
  async function issueMonthly() {
    if (!monthly || busy) return;
    setBusy(true);
    setError("");
    try {
      let record: Row;
      if (demo) {
        if (!company?.data.address)
          throw new Error("自社情報を登録してください");
        record = await persist(
          "document",
          monthlyDocument(
            monthlyOrders,
            customers.find((c) => c.id === monthly.customerId)!.data,
            company.data,
            monthly.month,
            monthly.previousBalance,
            monthly.payment,
          ),
        );
      } else {
        const res = await fetch("/api/monthly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...monthly,
            orderIds: monthlyOrders.map((r) => r.id),
          }),
        });
        const body = (await res.json()) as { record: Row; error: string };
        if (!res.ok) throw new Error(body.error);
        record = body.record;
        setRows((old) => [record, ...old]);
      }
      setPreview(record as Row<DocumentData>);
      setMonthly(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function downloadPdf() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const { downloadDocumentPdf } = await import("../lib/pdf");
      await downloadDocumentPdf(preview, demo);
    } catch (e) {
      setError((e as Error).message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const orderTable = (list: Row<Order>[]) =>
    list.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>受注番号 / 件名</th>
              <th>顧客</th>
              <th>受注日 / 業務</th>
              <th>ステータス</th>
              <th className="numeric">税込金額</th>
              <th>帳票を発行</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>
                  <button
                    className="text-button"
                    onClick={() => start("order", r)}
                  >
                    {r.data.title}
                  </button>
                  <small>{number(r)}</small>
                </td>
                <td>{customerName(r.data.customerId)}</td>
                <td className="nowrap">
                  {r.data.date.replaceAll("-", ".")}
                  <small>
                    {r.data.businessType} / 仕切 {r.data.wholesaleRate}%
                  </small>
                </td>
                <td>
                  <span
                    className={`badge status-${statuses.indexOf(r.data.status)}`}
                  >
                    {r.data.status}
                  </span>
                </td>
                <td className="numeric strong">
                  {money(orderTotals(r.data).total)}
                </td>
                <td>
                  <div className="doc-actions">
                    {(
                      ["見積書", "納品書", "請求書", "納品請求書"] as const
                    ).map((t) => (
                      <button
                        key={t}
                        disabled={busy}
                        onClick={() => issue(r, t)}
                        title={`${t}を新規発行`}
                      >
                        {t === "請求書" ? "単体請求" : t.slice(0, -1)}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`${r.data.title}を編集`}
                    onClick={() => start("order", r)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        label="受注がありません"
        description="顧客と商品を登録して、最初の受注を作成しましょう。"
        action={() => start("order")}
        disabled={!canEdit}
        button="受注を作成"
      />
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div>
            <span className="monoral-logo"><img src="/brand/monoral_h6.png" alt="MONORAL" /></span><small>ORDER MANAGEMENT</small>
          </div>
        </div>
        <div className="workspace">
          <span className="workspace-dot" />
          MONORAL 販売管理<small>WORKSPACE</small>
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "order" && orders.length > 0 && (
                <span>{orders.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="connection">
            <span className={connected ? "live-dot" : "demo-dot"} />
            {demo
              ? "デモモード"
              : connected
                ? "Supabase 接続済み"
                : "Supabase 未接続"}
          </div>
          <div className="account">
            <span className="avatar">M</span>
            <div>
              <strong>マイワークスペース</strong>
              <small title={userName}>{userName}</small>
            </div>
          </div>
          <a href="/signout-with-chatgpt?return_to=/" target="_top">
            ログアウト
          </a>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            MONORAL <ChevronRight size={13} />{" "}
            {nav.find((n) => n.id === page)?.label}
          </span>
          <div>
            <span className="date">{today().replaceAll("-", " / ")}</span>
            <button
              className="icon-button"
              aria-label="再読み込み"
              onClick={() => void load()}
              disabled={loading || busy}
            >
              <RefreshCw size={17} />
            </button>
            <span className="top-avatar">M</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{titles[page][0]}</p>
              <h1>{titles[page][1]}</h1>
              <p className="subheading">
                {page === "overview"
                  ? "受注から帳票まで、日々の流れをシンプルに。"
                  : page === "order"
                    ? "ご注文の進行状況と明細をまとめて管理。"
                    : page === "customer"
                      ? "取引先の連絡先と請求先情報。"
                      : page === "product"
                        ? "商品コード・販売単価・税率を管理。"
                        : page === "document"
                          ? "発行時の内容を保存した帳票の一覧。"
                          : "帳票に表示する発行元・振込先を設定。"}
              </p>
            </div>
            {page === "document" && (
              <button
                className="primary"
                disabled={!canEdit || !customers.length}
                onClick={() =>
                  setMonthly({
                    customerId: customers[0]?.id || "",
                    month: today().slice(0, 7),
                    previousBalance: 0,
                    payment: 0,
                  })
                }
              >
                <Plus size={18} />
                月締め合計請求書
              </button>
            )}
            {page !== "company" && page !== "document" && (
              <button
                className="primary"
                disabled={!canEdit || loading}
                onClick={() => start(page === "overview" ? "order" : page)}
              >
                <Plus size={18} />
                {page === "overview" ? "受注を作成" : `${kinds[page]}を登録`}
              </button>
            )}
          </div>
          {!connected && !loading && (
            <div className="setup-banner">
              <Leaf size={22} />
              <div>
                <strong>
                  {demo ? "デモで操作をお試し中" : "最初の準備をはじめましょう"}
                </strong>
                <p>
                  {demo
                    ? "架空のサンプルデータです。変更はこの画面内のみで、再読み込みすると消えます。"
                    : "Supabaseを接続すると、外出先からも同じデータを保存・編集できます。"}
                </p>
              </div>
              {!demo && (
                <button
                  className="secondary"
                  onClick={() => {
                    setRows(demoRecords());
                    setDemo(true);
                    setError("");
                  }}
                >
                  デモを試す <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              <AlertCircle size={18} />
              {error}
              <button onClick={() => setError("")} aria-label="閉じる">
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">データを読み込んでいます…</div>
          ) : (
            <>
              {page === "overview" && (
                <>
                  <div className="stats">
                    <Stat
                      label="今月の受注金額"
                      value={money(
                        confirmed.reduce(
                          (s, r) => s + orderTotals(r.data).total,
                          0,
                        ),
                      )}
                      sub={`${month.replace("-", "年")}月・確定した受注（税込）`}
                      accent
                    />
                    <Stat
                      label="進行中の受注"
                      value={`${orders.filter((o) => ["受注確定", "出荷済"].includes(o.data.status)).length}`}
                      sub="受注確定・出荷済"
                    />
                    <Stat
                      label="見積中"
                      value={`${orders.filter((o) => o.data.status === "見積中").length}`}
                      sub="確認・ご返答待ち"
                    />
                    <Stat
                      label="登録顧客"
                      value={`${customers.length}`}
                      sub="大切な取引先"
                    />
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>最近の受注</h2>
                        <p>日々の進行を確認しましょう</p>
                      </div>
                      <button
                        className="text-button link"
                        onClick={() => go("order")}
                      >
                        すべて見る <ArrowUpRight size={16} />
                      </button>
                    </div>
                    {orderTable(visibleOrders.slice(0, 6))}
                  </section>
                  <div className="quick-grid">
                    <button
                      className="quick-card"
                      onClick={() => go("customer")}
                    >
                      <Users />
                      <div>
                        <strong>顧客情報を整える</strong>
                        <p>取引先と連絡先をひとつに。</p>
                      </div>
                      <ArrowUpRight />
                    </button>
                    <button
                      className="quick-card"
                      onClick={() => go("document")}
                    >
                      <FileText />
                      <div>
                        <strong>必要な帳票を、すぐに</strong>
                        <p>見積書・納品書・請求書。</p>
                      </div>
                      <ArrowUpRight />
                    </button>
                  </div>
                </>
              )}
              {page === "order" && (
                <section className="panel">
                  <Toolbar
                    search={search}
                    setSearch={setSearch}
                    placeholder="受注番号・顧客情報・件名を検索"
                  >
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      aria-label="ステータスで絞り込み"
                    >
                      <option>すべて</option>
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Toolbar>
                  {orderTable(
                    visibleOrders.filter(
                      (r) =>
                        matches(r) ||
                        customerName(r.data.customerId).includes(search),
                    ),
                  )}
                </section>
              )}
              {page === "customer" && (
                <>
                  <CustomerImporter
                    enabled={connected && !demo}
                    onImported={(incoming) =>
                      setRows((old) => [...incoming, ...old])
                    }
                  />
                  <section className="panel">
                    <Toolbar
                      search={search}
                      setSearch={setSearch}
                      placeholder="顧客名・担当者・連絡先で検索"
                    >
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        aria-label="顧客カテゴリー"
                      >
                        <option>すべて</option>
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <span className="muted">{customers.length} 件</span>
                    </Toolbar>
                    {customers.length ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>顧客名</th>
                              <th>分類 / 担当者</th>
                              <th>連絡先</th>
                              <th>所在地</th>
                              <th>受注数</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {customers
                              .filter(matches)
                              .filter(
                                (r) =>
                                  filter === "すべて" ||
                                  r.data.category === filter,
                              )
                              .map((r) => (
                                <tr key={r.id}>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() => start("customer", r)}
                                    >
                                      {r.data.name}
                                    </button>
                                    <small>{number(r)}</small>
                                  </td>
                                  <td>
                                    <span className="badge">
                                      {r.data.category}
                                    </span>
                                    <small>{r.data.contact || "—"}</small>
                                  </td>
                                  <td>
                                    {r.data.email || "—"}
                                    <small>{r.data.phone}</small>
                                  </td>
                                  <td>{r.data.address || "—"}</td>
                                  <td>
                                    {
                                      orders.filter(
                                        (o) => o.data.customerId === r.id,
                                      ).length
                                    }
                                  </td>
                                  <td>
                                    <button
                                      className="icon-button"
                                      aria-label={`${r.data.name}を編集`}
                                      onClick={() => start("customer", r)}
                                    >
                                      <ChevronRight size={17} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        label="顧客を登録しましょう"
                        description="登録した顧客は、受注と帳票の作成時に選べます。"
                        button="顧客を登録"
                        disabled={!canEdit}
                        action={() => start("customer")}
                      />
                    )}
                  </section>
                </>
              )}
              {page === "product" && (
                <section className="panel">
                  <Toolbar
                    search={search}
                    setSearch={setSearch}
                    placeholder="商品名・商品コードで検索"
                  >
                    <span className="muted">{products.length} 商品</span>
                  </Toolbar>
                  {products.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>商品</th>
                            <th>商品コード</th>
                            <th className="numeric">販売単価（税抜）</th>
                            <th>税率</th>
                            <th>単位</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {products.filter(matches).map((r) => (
                            <tr key={r.id}>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => start("product", r)}
                                >
                                  {r.data.name}
                                </button>
                                <small>{r.data.note}</small>
                              </td>
                              <td>
                                <code>{r.data.sku}</code>
                              </td>
                              <td className="numeric strong">
                                {money(r.data.price)}
                              </td>
                              <td>{r.data.tax}%</td>
                              <td>{r.data.unit}</td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`${r.data.name}を編集`}
                                  onClick={() => start("product", r)}
                                >
                                  <ChevronRight size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      label="商品を登録しましょう"
                      description="単価と税率を設定すると、受注の明細をすばやく入力できます。"
                      button="商品を登録"
                      disabled={!canEdit}
                      action={() => start("product")}
                    />
                  )}
                </section>
              )}
              {page === "document" && (
                <section className="panel">
                  <Toolbar
                    search={search}
                    setSearch={setSearch}
                    placeholder="帳票番号・顧客名・件名で検索"
                  >
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      aria-label="帳票の種類"
                    >
                      <option>すべて</option>
                      {documentTypes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Toolbar>
                  {docs.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>帳票番号</th>
                            <th>種類</th>
                            <th>顧客 / 件名</th>
                            <th>発行日</th>
                            <th className="numeric">税込金額</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {docs
                            .filter(matches)
                            .filter(
                              (r) =>
                                filter === "すべて" || r.data.type === filter,
                            )
                            .map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <button
                                    className="text-button"
                                    onClick={() => setPreview(r)}
                                  >
                                    {number(r)}
                                  </button>
                                </td>
                                <td>
                                  <span className="badge">{r.data.type}</span>
                                </td>
                                <td>
                                  {r.data.customer.name}
                                  <small>{r.data.order.title}</small>
                                </td>
                                <td>{r.data.date}</td>
                                <td className="numeric">
                                  {money(documentTotal(r.data))}
                                </td>
                                <td>
                                  <button
                                    className="secondary small"
                                    onClick={() => setPreview(r)}
                                  >
                                    <Printer size={15} />
                                    表示
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      label="発行した帳票がここに並びます"
                      description="受注一覧から見積書・納品書・請求書を発行できます。"
                      button="受注一覧へ"
                      action={() => go("order")}
                    />
                  )}
                </section>
              )}
              {page === "company" && (
                <div className="settings-grid">
                  <section className="panel settings-card">
                    <div className="panel-heading">
                      <h2>発行元情報</h2>
                      <button
                        className="secondary"
                        disabled={!canEdit}
                        onClick={() => start("company", company)}
                      >
                        編集する
                      </button>
                    </div>
                    <dl>
                      {[
                        ["名称", company?.data.name || "MONORAL"],
                        ["郵便番号", company?.data.postal],
                        ["住所", company?.data.address],
                        ["電話番号", company?.data.phone],
                        ["メール", company?.data.email],
                        ["登録番号", company?.data.registration],
                        ["振込先", company?.data.bank],
                        ["帳票の備考", company?.data.note],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value || "未設定"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <div>
                    <section className="panel settings-card">
                      <h2>データの保存先</h2>
                      <p className="setting-status">
                        {connected ? "Supabase 接続済み" : "Supabase 未接続"}
                      </p>
                      <p className="muted">
                        MONORAL専用プロジェクトに保存します。同じアカウントでログインすると、別の端末でも利用できます。
                      </p>
                      {!connected && (
                        <p className="muted">
                          プロジェクト作成と接続設定が完了するまで、本番データは保存できません。
                        </p>
                      )}
                    </section>
                    <section className="panel settings-card">
                      <h2>データを書き出す</h2>
                      <p className="muted">
                        現在の顧客・商品・受注・帳票をJSON形式で保存します。
                      </p>
                      <button
                        className="secondary"
                        disabled={!canEdit}
                        onClick={exportData}
                      >
                        <Download size={16} />
                        データを書き出す
                      </button>
                    </section>
                  </div>
                </div>
              )}
            </>
          )}
          <footer className="footer">
            <span>MONORAL / ORDER MANAGEMENT</span>
            <span>
              {demo
                ? "DEMO — サンプルデータ"
                : connected
                  ? "PRIVATE WORKSPACE"
                  : "SETUP REQUIRED"}
            </span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {editing && (
        <div className="overlay">
          <div
            className={`modal ${editing.kind === "order" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${kinds[editing.kind]}の編集`}
          >
            <form onSubmit={save}>
              <div className="modal-header">
                <div>
                  <p className="eyebrow">
                    {editing.row ? number(editing.row) : "NEW RECORD"}
                  </p>
                  <h2>
                    {kinds[editing.kind]}
                    {editing.row ? "を編集" : "を登録"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setError("");
                  }}
                  aria-label="閉じる"
                >
                  <X />
                </button>
              </div>
              <div className="modal-body">
                {error && (
                  <div role="alert" className="error">
                    {error}
                  </div>
                )}
                {editing.kind === "customer" && (
                  <div className="form-grid">
                    <label>
                      カテゴリー
                      <select
                        value={(editing.data as Customer).category}
                        onChange={(e) => update("category", e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="顧客名"
                      required
                      value={(editing.data as Customer).name}
                      set={(v) => update("name", v)}
                    />
                    <Field
                      label="担当者"
                      value={(editing.data as Customer).contact}
                      set={(v) => update("contact", v)}
                    />
                    <Field
                      label="メールアドレス"
                      type="email"
                      value={(editing.data as Customer).email}
                      set={(v) => update("email", v)}
                    />
                    <Field
                      label="電話番号"
                      value={(editing.data as Customer).phone}
                      set={(v) => update("phone", v)}
                    />
                    <Field
                      label="郵便番号"
                      value={(editing.data as Customer).postal}
                      set={(v) => update("postal", v)}
                    />
                    <Field
                      label="住所（帳票の宛先）"
                      value={(editing.data as Customer).address}
                      set={(v) => update("address", v)}
                    />
                    <Field
                      label="メモ"
                      area
                      value={(editing.data as Customer).note}
                      set={(v) => update("note", v)}
                    />
                  </div>
                )}
                {editing.kind === "product" && (
                  <div className="form-grid">
                    <Field
                      label="商品名"
                      required
                      value={(editing.data as Product).name}
                      set={(v) => update("name", v)}
                    />
                    <Field
                      label="商品コード"
                      required
                      value={(editing.data as Product).sku}
                      set={(v) => update("sku", v)}
                    />
                    <Field
                      label="販売単価（税抜・円）"
                      type="number"
                      required
                      value={(editing.data as Product).price}
                      set={(v) => update("price", Number(v))}
                    />
                    <Field
                      label="単位"
                      required
                      value={(editing.data as Product).unit}
                      set={(v) => update("unit", v)}
                    />
                    <label>
                      税率
                      <select
                        value={(editing.data as Product).tax}
                        onChange={(e) => update("tax", Number(e.target.value))}
                      >
                        <option value={10}>10%</option>
                        <option value={8}>8%</option>
                        <option value={0}>0%</option>
                      </select>
                    </label>
                    <Field
                      label="メモ"
                      area
                      value={(editing.data as Product).note}
                      set={(v) => update("note", v)}
                    />
                  </div>
                )}
                {editing.kind === "company" && (
                  <div className="form-grid">
                    {[
                      ["name", "名称"],
                      ["postal", "郵便番号"],
                      ["address", "住所"],
                      ["phone", "電話番号"],
                      ["email", "メールアドレス"],
                      ["registration", "適格請求書発行事業者の登録番号"],
                      ["bank", "振込先"],
                      ["note", "帳票の備考"],
                    ].map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        required={key === "name" || key === "address"}
                        area={key === "bank" || key === "note"}
                        type={key === "email" ? "email" : "text"}
                        value={(editing.data as Company)[key as keyof Company]}
                        set={(v) => update(key, v)}
                      />
                    ))}
                  </div>
                )}
                {editing.kind === "order" && (
                  <>
                    <div className="form-grid">
                      <label>
                        業務種類
                        <select
                          value={(editing.data as Order).businessType}
                          onChange={(e) =>
                            update("businessType", e.target.value)
                          }
                        >
                          {businessTypes.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        仕切り率（%）
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          required
                          value={(editing.data as Order).wholesaleRate}
                          onChange={(e) =>
                            update("wholesaleRate", Number(e.target.value))
                          }
                        />
                        <small>
                          定価 × 仕切り率。例：65% =
                          定価の65%。単価の1円未満を切り捨て。
                        </small>
                      </label>
                      <Field
                        label="件名"
                        required
                        value={(editing.data as Order).title}
                        set={(v) => update("title", v)}
                      />
                      <label>
                        顧客 <span className="required">*</span>
                        <select
                          required
                          value={(editing.data as Order).customerId}
                          onChange={(e) => update("customerId", e.target.value)}
                        >
                          <option value="">顧客を選択</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.data.name}
                            </option>
                          ))}
                        </select>
                        {!customers.length && (
                          <small>先に顧客管理で顧客を登録してください。</small>
                        )}
                      </label>
                      <Field
                        label="受注日"
                        required
                        type="date"
                        value={(editing.data as Order).date}
                        set={(v) => update("date", v)}
                      />
                      <label>
                        ステータス
                        <select
                          value={(editing.data as Order).status}
                          onChange={(e) => update("status", e.target.value)}
                        >
                          {statuses.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <Field
                        label="納品予定日"
                        type="date"
                        value={(editing.data as Order).deliveryDate}
                        set={(v) => update("deliveryDate", v)}
                      />
                      <Field
                        label="支払期日"
                        type="date"
                        value={(editing.data as Order).dueDate}
                        set={(v) => update("dueDate", v)}
                      />
                    </div>
                    <div className="line-heading">
                      <h3>商品明細</h3>
                      <select
                        aria-label="商品を追加"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) addLine(e.target.value);
                        }}
                      >
                        <option value="">＋ 商品を追加</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.data.name} / {p.data.sku}
                          </option>
                        ))}
                        <option value="manual">自由入力</option>
                      </select>
                    </div>
                    <div className="line-items">
                      {(editing.data as Order).items.map((item, i) => (
                        <div className="line-item" key={i}>
                          <label className="line-name">
                            商品名
                            <input
                              required
                              aria-label={`明細${i + 1} 商品名`}
                              value={item.name}
                              onChange={(e) =>
                                lineUpdate(i, "name", e.target.value)
                              }
                            />
                          </label>
                          <label>
                            数量
                            <input
                              type="number"
                              min={1}
                              max={10000}
                              required
                              value={item.qty}
                              onChange={(e) =>
                                lineUpdate(i, "qty", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            単位
                            <input
                              required
                              value={item.unit}
                              onChange={(e) =>
                                lineUpdate(i, "unit", e.target.value)
                              }
                            />
                          </label>
                          <label>
                            定価（税抜）
                            <input
                              type="number"
                              min={0}
                              max={100000000}
                              required
                              value={item.price}
                              onChange={(e) =>
                                lineUpdate(i, "price", Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            税率
                            <select
                              value={item.tax}
                              onChange={(e) =>
                                lineUpdate(i, "tax", Number(e.target.value))
                              }
                            >
                              <option value={10}>10%</option>
                              <option value={8}>8%</option>
                              <option value={0}>0%</option>
                            </select>
                          </label>
                          <div className="line-total">
                            {money(
                              pricedLines(editing.data as Order)[i].qty *
                                pricedLines(editing.data as Order)[i].price,
                            )}
                          </div>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`明細${i + 1}を取り除く`}
                            onClick={() =>
                              update(
                                "items",
                                (editing.data as Order).items.filter(
                                  (_, j) => j !== i,
                                ),
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      {!(editing.data as Order).items.length && (
                        <p className="empty-lines">
                          商品を選択、または自由入力で明細を追加してください。
                        </p>
                      )}
                    </div>
                    <div className="order-totals">
                      <div>
                        税抜小計
                        <strong>
                          {money(orderTotals(editing.data as Order).subtotal)}
                        </strong>
                      </div>
                      <div>
                        消費税
                        <strong>
                          {money(orderTotals(editing.data as Order).tax)}
                        </strong>
                      </div>
                      <div className="grand-total">
                        税込合計
                        <strong>
                          {money(orderTotals(editing.data as Order).total)}
                        </strong>
                      </div>
                      <small>
                        税率ごとに合計し、税額の1円未満を切り捨てます。
                      </small>
                    </div>
                    <Field
                      label="備考（帳票に表示）"
                      area
                      value={(editing.data as Order).note}
                      set={(v) => update("note", v)}
                    />
                  </>
                )}
              </div>
              <div className="modal-footer">
                <span>
                  {demo
                    ? "デモ内のみの保存です"
                    : "変更はSupabaseに保存されます"}
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setError("");
                  }}
                >
                  キャンセル
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "保存中…" : "保存する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {monthly && (
        <div className="overlay">
          <div
            className="modal wide"
            role="dialog"
            aria-modal="true"
            aria-label="月締め合計請求書"
          >
            <div className="modal-header">
              <h2>月締め合計請求書</h2>
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => setMonthly(null)}
                aria-label="閉じる"
              >
                <X />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="error">{error}</div>}
              <div className="form-grid">
                <label>
                  顧客
                  <select
                    value={monthly.customerId}
                    onChange={(e) =>
                      setMonthly({ ...monthly, customerId: e.target.value })
                    }
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.data.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  対象月（末日締め）
                  <input
                    type="month"
                    required
                    value={monthly.month}
                    onChange={(e) =>
                      setMonthly({ ...monthly, month: e.target.value })
                    }
                  />
                </label>
                <Field
                  label="前回繰越額（円）"
                  type="text"
                  value={monthly.previousBalance}
                  set={(v) =>
                    setMonthly({ ...monthly, previousBalance: Number(v) })
                  }
                />
                <Field
                  label="入金・相殺額（円）"
                  type="number"
                  value={monthly.payment}
                  set={(v) => setMonthly({ ...monthly, payment: Number(v) })}
                />
              </div>
              <p className="muted" style={{ margin: "20px 0" }}>
                納品予定日（未指定の場合は受注日）が対象月の確定済み伝票を集計します。単体請求・納品請求・合計請求で請求済みの伝票は除外します。
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>対象伝票</th>
                      <th>業務</th>
                      <th>税込金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          {number(o)} / {o.data.title}
                        </td>
                        <td>{o.data.businessType}</td>
                        <td>{money(orderTotals(o.data).total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                {monthlyOrders.length}{" "}
                件。月次の税額は税率別の税抜合計から再計算します。
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setMonthly(null)}
              >
                キャンセル
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  !monthlyOrders.length ||
                  !Number.isInteger(monthly.previousBalance) ||
                  !Number.isInteger(monthly.payment) ||
                  monthly.payment < 0
                }
                onClick={() => void issueMonthly()}
              >
                {busy ? "発行中…" : "合計請求書を発行"}
              </button>
            </div>
          </div>
        </div>
      )}
      {preview && (
        <div className="document-overlay">
          <div className="document-toolbar">
            <button className="secondary" onClick={() => setPreview(null)}>
              <ArrowLeft size={16} />
              戻る
            </button>
            <span>
              {number(preview)}
              {demo ? " / デモ帳票" : ""}
            </span>
            <div className="doc-actions">
              <button className="secondary" onClick={() => window.print()}>
                <Printer size={16} />
                印刷
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void downloadPdf()}
              >
                <Download size={16} />
                {busy ? "作成中…" : "PDF書き出し"}
              </button>
            </div>
          </div>
          <Document row={preview} demo={demo} />
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}
function Toolbar({
  search,
  setSearch,
  placeholder,
  children,
}: {
  search: string;
  setSearch: (v: string) => void;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="toolbar">
      <label className="search">
        <Search size={17} />
        <input
          aria-label="検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
        />
      </label>
      {children}
    </div>
  );
}
function Empty({
  label,
  description,
  button,
  action,
  disabled = false,
}: {
  label: string;
  description: string;
  button: string;
  action: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ShoppingBag size={28} />
      </div>
      <h3>{label}</h3>
      <p>{description}</p>
      <button className="secondary" disabled={disabled} onClick={action}>
        <Plus size={16} />
        {button}
      </button>
    </div>
  );
}
function Field({
  label,
  value,
  set,
  required = false,
  type = "text",
  area = false,
}: {
  label: string;
  value: string | number;
  set: (v: string) => void;
  required?: boolean;
  type?: string;
  area?: boolean;
}) {
  return (
    <label className={area ? "full-width" : ""}>
      {label}
      {required && <span className="required"> *</span>}
      {area ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => set(e.target.value)}
        />
      ) : (
        <input
          required={required}
          type={type}
          min={type === "number" ? 0 : undefined}
          max={type === "number" ? 100000000 : undefined}
          value={value}
          onChange={(e) => set(e.target.value)}
        />
      )}
    </label>
  );
}
function Document({ row, demo }: { row: Row<DocumentData>; demo: boolean }) {
  const d = row.data,
    t = orderTotals(d.order);
  return (
    <article className="paper">
      {demo && <div className="demo-watermark">SAMPLE — デモ帳票</div>}
      <header className="paper-header">
        <span className="monoral-logo"><img src="/brand/monoral_h6.png" alt="MONORAL" /></span>
        <div>
          <h1>{d.type}</h1>
          <p>
            No. {number(row)}
            <br />
            発行日 {d.date}
          </p>
        </div>
      </header>
      <div className="paper-parties">
        <div>
          <h2>{d.customer.name} 御中</h2>
          <p>
            〒 {d.customer.postal}
            <br />
            {d.customer.address}
            <br />
            {d.customer.contact && `${d.customer.contact} 様`}
          </p>
        </div>
        <div>
          <strong>{d.company.name}</strong>
          <p>
            〒 {d.company.postal}
            <br />
            {d.company.address}
            <br />
            {d.company.phone}
            <br />
            {d.company.email}
            {d.company.registration && (
              <>
                <br />
                登録番号 {d.company.registration}
              </>
            )}
          </p>
        </div>
      </div>
      <p className="paper-subject">件名：{d.order.title}</p>
      <div className="paper-amount">
        <span>
          {d.type === "見積書"
            ? "お見積金額"
            : d.type.includes("請求")
              ? "ご請求金額"
              : "納品金額"}
        </span>
        <strong>{money(documentTotal(d))}</strong>
        <small>（税込）</small>
      </div>
      <div className="paper-dates">
        <span>受注番号：{d.orderNumber}</span>
        <span>
          {d.monthly
            ? "各伝票の仕切り率を適用"
            : `${d.order.businessType} / 仕切り率 ${d.order.wholesaleRate}%`}
        </span>
        {d.order.deliveryDate && (
          <span>納品予定日：{d.order.deliveryDate}</span>
        )}
        {d.order.dueDate && <span>支払期日：{d.order.dueDate}</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th>品名</th>
            <th>数量</th>
            <th>単価（税抜）</th>
            <th>税率</th>
            <th>金額（税抜）</th>
          </tr>
        </thead>
        <tbody>
          {pricedLines(d.order).map((i, n) => (
            <tr key={n}>
              <td>
                {i.name}
                {i.sku && <small>{i.sku}</small>}
              </td>
              <td>
                {i.qty} {i.unit}
              </td>
              <td>{money(i.price)}</td>
              <td>{i.tax}%</td>
              <td>{money(i.qty * i.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="paper-summary">
        <div>
          <span>税抜小計</span>
          <strong>{money(t.subtotal)}</strong>
        </div>
        {t.groups.map((g) => (
          <div key={g.rate}>
            <span>
              {g.rate}%対象 {money(g.subtotal)} / 消費税
            </span>
            <strong>{money(g.tax)}</strong>
          </div>
        ))}
        {d.monthly && (
          <>
            <div>
              <span>前回繰越額</span>
              <strong>{money(d.monthly.previousBalance)}</strong>
            </div>
            <div>
              <span>入金・相殺額</span>
              <strong>{money(d.monthly.payment)}</strong>
            </div>
          </>
        )}
        <div className="paper-grand">
          <span>合計</span>
          <strong>{money(documentTotal(d))}</strong>
        </div>
      </div>
      {d.type.includes("請求") && d.company.bank && (
        <section className="paper-note">
          <h3>お振込先</h3>
          <p>{d.company.bank}</p>
        </section>
      )}
      {(d.order.note || d.company.note) && (
        <section className="paper-note">
          <h3>備考</h3>
          <p>{[d.order.note, d.company.note].filter(Boolean).join("\n")}</p>
        </section>
      )}
      <footer>MONORAL / {number(row)}</footer>
    </article>
  );
}
