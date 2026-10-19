"use client";
import { useState } from "react";
import { parseCustomerImport } from "../lib/customer-import";
import { type Customer, type Row } from "../lib/model";
export default function CustomerImporter({
  enabled,
  onImported,
}: {
  enabled: boolean;
  onImported: (rows: Row[]) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="panel settings-card">
      <h2>現ソフトの顧客を取り込む</h2>
      <p className="muted">
        変換済みの顧客JSONを選択してください。同じ旧顧客番号は追加されません。既存の顧客情報は上書きしません。
      </p>
      <input
        style={{ marginTop: 14 }}
        type="file"
        accept=".json"
        aria-label="顧客インポートJSON"
        disabled={!enabled || busy}
        onChange={async (e) => {
          try {
            setError("");
            setMessage("");
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2000000) throw new Error("ファイルが大きすぎます");
            setCustomers(parseCustomerImport(JSON.parse(await file.text())));
          } catch (e) {
            setError((e as Error).message);
            setCustomers([]);
          }
        }}
      />
      {customers.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p>{customers.length} 件を確認しました</p>
          <p className="muted">
            {customers
              .slice(0, 5)
              .map((c) => c.name)
              .join(" / ")}
            {customers.length > 5 ? " …" : ""}
          </p>
          <button
            disabled={busy}
            className="primary"
            onClick={async () => {
              setBusy(true);
              try {
                const res = await fetch("/api/import-customers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ customers }),
                });
                const body = (await res.json()) as {
                  records: Row[];
                  error: string;
                };
                if (!res.ok) throw new Error(body.error);
                onImported(body.records);
                setMessage(
                  `${body.records.length} 件を追加しました。${customers.length - body.records.length} 件は登録済みのためスキップしました。`,
                );
                setCustomers([]);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "取り込み中…" : `${customers.length} 件を追加する`}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!enabled && <p className="muted">Supabase接続後に利用できます。</p>}
    </section>
  );
}
