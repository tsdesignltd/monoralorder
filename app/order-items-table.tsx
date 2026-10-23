"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { money, type Line, type Product, type Row } from "../lib/model";

const blankLine = (): Line => ({ productId: "", sku: "", name: "", unit: "個", qty: 1, price: 0, tax: 10 });
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja")
  .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[‐‑‒–—―-]/g, "");
type SearchField = "sku" | "name";

function NumberCell({ value, min, max, label, required, resetKey, onChange }: {
  value?: number; min: number; max: number; label: string; required: boolean;
  resetKey: string; onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(value === undefined ? "" : String(value));
    input.current?.setCustomValidity("");
  }, [value, resetKey]);
  return <input ref={input} aria-label={label} type="text" inputMode="numeric" pattern="[0-9]+"
    required={required} value={draft} placeholder={String(min)} onChange={e => {
      const text = e.target.value.normalize("NFKC"), n = Number(text);
      const valid = /^[0-9]+$/.test(text) && n >= min && n <= max;
      setDraft(text);
      e.target.setCustomValidity(text && !valid ? `${min.toLocaleString()}〜${max.toLocaleString()}の整数を入力してください` : "");
      if (valid) onChange(n);
    }} />;
}

export default function OrderItemsTable({ items, products, returns, onChange }: {
  items: Line[]; products: Row<Product>[]; returns: boolean;
  onChange: (items: Line[]) => void;
}) {
  const id = useId();
  const [rowKeys, setRowKeys] = useState(() => items.map(() => crypto.randomUUID()));
  const [blankKey, setBlankKey] = useState(() => crypto.randomUUID());
  const [active, setActive] = useState<{ row: number; field: SearchField } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 220, transform: "none" });
  const [portal, setPortal] = useState<Element | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const displayItems = items.length < 100 ? [...items, blankLine()] : items;
  const query = active ? displayItems[active.row]?.[active.field] || "" : "";
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const matches = products.filter(p => {
    const text = normalize(`${p.data.sku} ${p.data.name}`);
    return words.every(word => text.includes(word));
  });
  function positionPopup() {
    if (!input.current) return;
    const rect = input.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 340), window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 12;
    const above = below < 140 && rect.top > below;
    const height = Math.min(260, Math.max(80, above ? rect.top - 16 : below));
    setPosition({ left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
      top: above ? rect.top - 4 : rect.bottom + 4, width, maxHeight: height, transform: above ? "translateY(-100%)" : "none" });
  }
  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    return () => { window.removeEventListener("resize", positionPopup); window.removeEventListener("scroll", positionPopup, true); };
  }, [active]);
  useEffect(() => {
    if (active) document.getElementById(`${id}-option-${highlight}`)?.scrollIntoView({ block: "nearest" });
  }, [active, highlight, id]);
  function open(row: number, field: SearchField, target: HTMLInputElement) {
    input.current = target; setPortal(target.closest(".modal")); setActive({ row, field }); setHighlight(0); positionPopup();
  }
  function change(row: number, patch: Partial<Line>) {
    if (row === items.length) {
      setRowKeys(keys => [...keys, blankKey]);
      setBlankKey(crypto.randomUUID());
    }
    const next = [...items];
    next[row] = { ...(next[row] || blankLine()), ...patch };
    onChange(next);
  }
  function choose(product: Row<Product>) {
    if (!active) return;
    const p = product.data;
    change(active.row, { productId: product.id, sku: p.sku, name: p.name, unit: p.unit, price: p.price, tax: p.tax });
    setActive(null);
  }
  function searchInput(item: Line, row: number, field: SearchField) {
    const expanded = active?.row === row && active.field === field;
    return <input role="combobox" aria-label={`明細${row + 1} ${field === "sku" ? "商品番号" : "商品名"}`}
      aria-expanded={expanded} aria-autocomplete="list" aria-controls={expanded ? `${id}-products` : undefined}
      aria-activedescendant={expanded && matches[highlight] ? `${id}-option-${highlight}` : undefined}
      autoComplete="off" required={field === "name" && row < items.length}
      placeholder={field === "sku" ? "番号で検索" : "商品名で検索・自由入力"} value={item[field]}
      onFocus={e => open(row, field, e.currentTarget)}
      onClick={e => { if (!expanded) open(row, field, e.currentTarget); }}
      onChange={e => { change(row, { [field]: e.target.value, productId: "" }); open(row, field, e.currentTarget); }}
      onBlur={e => { if (!popup.current?.contains(e.relatedTarget)) setActive(null); }}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!expanded) open(row, field, e.currentTarget);
          else setHighlight(h => matches.length ? (h + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length : 0);
        } else if (e.key === "Enter") {
          e.preventDefault(); if (expanded && matches[highlight]) choose(matches[highlight]); else setActive(null);
        } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setActive(null); }
      }} />;
  }
  return <section className="order-items-section" aria-label="受注明細">
    <div className="line-heading"><h3>受注明細</h3><small>商品番号・商品名のセルから検索できます</small></div>
    <div className="order-items-scroll">
      <table className="order-items-table">
        <colgroup><col className="order-col-sku" /><col className="order-col-name" /><col className="order-col-unit" /><col className="order-col-qty" /><col className="order-col-price" /><col className="order-col-tax" /><col className="order-col-total" /><col className="order-col-delete" /></colgroup>
        <thead><tr><th scope="col">商品番号</th><th scope="col">商品名</th><th scope="col">単位</th><th scope="col">数量</th><th scope="col">定価（税抜）</th><th scope="col">税率</th><th scope="col">金額（定価）</th><th scope="col"><span className="order-sr-only">削除</span></th></tr></thead>
        <tbody>{displayItems.map((item, row) => {
          const filled = row < items.length;
          return <tr key={rowKeys[row] || blankKey} className={filled ? "" : "order-empty-row"}>
            <td>{searchInput(item, row, "sku")}</td><td>{searchInput(item, row, "name")}</td>
            <td><input aria-label={`明細${row + 1} 単位`} required={filled} value={filled ? item.unit : ""} placeholder="個" onChange={e => change(row, { unit: e.target.value })} /></td>
            <td><NumberCell label={`明細${row + 1} 数量`} value={filled ? item.qty : undefined} min={1} max={10000} required={filled} resetKey={item.productId} onChange={qty => change(row, { qty })} /></td>
            <td><NumberCell label={`明細${row + 1} 定価（税抜）`} value={filled ? item.price : undefined} min={0} max={100000000} required={filled} resetKey={item.productId} onChange={price => change(row, { price })} /></td>
            <td><select aria-label={`明細${row + 1} 税率`} value={item.tax} onChange={e => change(row, { tax: Number(e.target.value) as Line["tax"] })}><option value={10}>10%</option><option value={8}>8%</option><option value={0}>0%</option></select></td>
            <td className="order-item-amount">{filled ? money(item.price * item.qty * (returns ? -1 : 1)) : "—"}</td>
            <td>{filled && <button type="button" className="icon-button" aria-label={`明細${row + 1}を取り除く`} onClick={() => { setActive(null); setRowKeys(keys => keys.filter((_, i) => i !== row)); onChange(items.filter((_, i) => i !== row)); }}><X size={15} /></button>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="order-items-help">候補を選択すると単位・定価・税率が入ります。登録外の商品はそのまま自由入力できます。{items.length >= 100 ? "明細は100行までです。" : "末尾の空行から次の商品を入力できます。"}</p>
    {active && createPortal(<div ref={popup} className="order-product-popup" style={{ position: "fixed", zIndex: 3000, ...position }}>
      <div className="order-product-results" id={`${id}-products`} role="listbox" aria-label="商品の検索候補">
        {matches.map((p, i) => <button type="button" role="option" tabIndex={-1} id={`${id}-option-${i}`} key={p.id} aria-selected={i === highlight}
          className={i === highlight ? "active" : ""} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setHighlight(i)} onClick={() => choose(p)}>
          <strong>{p.data.sku}</strong><span>{p.data.name}</span><small>{money(p.data.price)}</small>
        </button>)}
      </div>
      <p role="status">{!matches.length ? "一致する商品がありません。自由入力もできます。" : `${matches.length}件・↑↓で移動、Enterで選択`}</p>
    </div>, portal || document.body)}
  </section>;
}
