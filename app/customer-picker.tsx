"use client";
import { useId, useState } from "react";
import { Search } from "lucide-react";
import { number, type Customer, type Row } from "../lib/model";

function searchable(value: string): string {
  return (value || "").normalize("NFKC").toLocaleLowerCase("ja")
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s‐‑‒–—―-]/g, "");
}

export default function CustomerPicker({ customers, value, onChange, required = false, className = "" }: {
  customers: Row<Customer>[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const words = query.trim().split(/\s+/).map(searchable).filter(Boolean);
  const matches = customers.filter(c => {
    const fields = [c.data.name, c.data.contact, c.data.phone, c.data.email,
      c.data.address, c.data.legacyId, number(c)].map(searchable);
    return words.every(word => fields.some(field => field.includes(word)));
  });
  const selected = customers.find(c => c.id === value);
  const keepSelected = selected && !matches.some(c => c.id === value);
  return <div className={`customer-picker ${className}`}>
    <label htmlFor={`${id}-select`}>顧客 {required && <span className="required">*</span>}</label>
    <div className="customer-picker-search">
      <Search size={16} aria-hidden="true" />
      <input type="search" aria-label="顧客をキーワード検索"
        placeholder="顧客名・担当者・電話番号などで検索"
        value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    <select id={`${id}-select`} required={required} value={value}
      aria-describedby={`${id}-status`} onChange={e => onChange(e.target.value)}>
      <option value="">顧客を選択</option>
      {keepSelected && <option value={selected.id}>選択中：{selected.data.name}</option>}
      {matches.map(c => <option key={c.id} value={c.id}>{c.data.name}</option>)}
    </select>
    <small id={`${id}-status`} role="status">
      {!customers.length ? "先に顧客管理で顧客を登録してください。" :
        !matches.length ? "一致する顧客がいません。別のキーワードで検索してください。" :
        `${matches.length}件${words.length ? "の顧客が一致" : "の顧客"}`}
    </small>
  </div>;
}
