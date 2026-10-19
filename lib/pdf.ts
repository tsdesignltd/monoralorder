import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { pdfFontkit as fontkit } from "./pdf-fontkit";
import {
  number,
  money,
  orderTotals,
  documentTotal,
  pricedLines,
  type Row,
  type DocumentData,
} from "./model";
export async function createDocumentPdf(
  row: Row<DocumentData>,
  fontBytes: Uint8Array,
  demo = false,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle(`${row.data.type} ${number(row)}`);
  pdf.setAuthor("MONORAL");
  let page = pdf.addPage([595.28, 841.89]),
    y = 790;
  const d = row.data,
    green = rgb(0.16, 0.31, 0.25),
    gray = rgb(0.42, 0.46, 0.42);
  const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b-\u001f]/g, "");
  function text(value: string, x: number, size = 10, color = green) {
    page.drawText(clean(value), { x, y, size, font, color });
  }
  function wrap(value: string, width: number, size = 10) {
    const lines: string[] = [];
    for (const paragraph of clean(value).split("\n")) {
      let line = "";
      for (const ch of paragraph) {
        if (font.widthOfTextAtSize(line + ch, size) > width && line) {
          lines.push(line);
          line = ch;
        } else line += ch;
      }
      lines.push(line);
    }
    return lines;
  }
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    y = 790;
    text(`${d.type}  ${number(row)}（続き）`, 42, 12);
    y -= 32;
  }
  function ensure(height: number) {
    if (y - height < 55) newPage();
  }
  function block(value: string, x = 42, width = 510, size = 10) {
    for (const line of wrap(value, width, size)) {
      ensure(size + 7);
      text(line, x, size);
      y -= size + 7;
    }
  }
  function rule() {
    page.drawLine({
      start: { x: 42, y },
      end: { x: 553, y },
      thickness: 0.6,
      color: rgb(0.78, 0.82, 0.76),
    });
    y -= 16;
  }
  text("MONORAL", 42, 24);
  text(d.type, 410, 22);
  y -= 35;
  if (demo) {
    text("SAMPLE / デモ帳票", 42, 11, rgb(0.6, 0.4, 0.2));
  }
  text(`No. ${number(row)}`, 390, 10);
  y -= 18;
  text(`発行日 ${d.date}`, 390, 10);
  y -= 25;
  rule();
  block(`${d.customer.name} 御中`, 42, 510, 16);
  block(
    [
      d.customer.postal && `〒 ${d.customer.postal}`,
      d.customer.address,
      d.customer.contact && `${d.customer.contact} 様`,
    ]
      .filter(Boolean)
      .join("\n"),
    42,
    510,
    10,
  );
  y -= 8;
  block(
    [
      d.company.name,
      d.company.postal && `〒 ${d.company.postal}`,
      d.company.address,
      d.company.phone,
      d.company.email,
      d.company.registration && `登録番号 ${d.company.registration}`,
    ]
      .filter(Boolean)
      .join("\n"),
    320,
    230,
    9,
  );
  y -= 16;
  block(`件名：${d.order.title}`, 42, 510, 12);
  ensure(60);
  page.drawRectangle({
    x: 42,
    y: y - 35,
    width: 511,
    height: 48,
    color: rgb(0.93, 0.95, 0.91),
  });
  y -= 15;
  text(d.type.includes("請求") ? "ご請求金額" : "合計金額", 55, 12);
  const amount = money(documentTotal(d));
  text(amount, 540 - font.widthOfTextAtSize(amount, 24), 24);
  y -= 45;
  block(
    d.monthly
      ? `対象月 ${d.monthly.month} / 各伝票の仕切り率を適用`
      : `${d.order.businessType} / 仕切り率 ${d.order.wholesaleRate}% / ${d.orderNumber}`,
    42,
    510,
    9,
  );
  if (d.order.deliveryDate)
    block(`納品予定日：${d.order.deliveryDate}`, 42, 510, 9);
  if (d.order.dueDate) block(`支払期日：${d.order.dueDate}`, 42, 510, 9);
  y -= 8;
  function tableHead() {
    ensure(45);
    page.drawRectangle({
      x: 42,
      y: y - 8,
      width: 511,
      height: 24,
      color: green,
    });
    text("品名", 50, 9, rgb(1, 1, 1));
    text("数量", 305, 9, rgb(1, 1, 1));
    text("単価（税抜）", 360, 9, rgb(1, 1, 1));
    text("税率", 438, 9, rgb(1, 1, 1));
    text("金額（税抜）", 478, 9, rgb(1, 1, 1));
    y -= 30;
  }
  tableHead();
  for (const i of pricedLines(d.order)) {
    const name = wrap(i.name, 240, 9);
    const height = Math.max(32, name.length * 15 + 12);
    if (y - height < 55) {
      newPage();
      tableHead();
    }
    const start = y;
    for (const line of name) {
      text(line, 50, 9);
      y -= 15;
    }
    y = start;
    text(`${i.qty} ${i.unit}`, 305, 9);
    text(money(i.price), 360, 9);
    text(`${i.tax}%`, 438, 9);
    const amount = money(i.qty * i.price);
    text(amount, 545 - font.widthOfTextAtSize(amount, 9), 9);
    y = start - height + 10;
    rule();
  }
  const t = orderTotals(d.order);
  ensure(155);
  y -= 8;
  function totalLine(label: string, value: number, big = false) {
    text(label, 285, big ? 12 : 9);
    const formatted = money(value);
    text(
      formatted,
      545 - font.widthOfTextAtSize(formatted, big ? 15 : 11),
      big ? 15 : 11,
    );
    y -= 24;
  }
  totalLine("税抜小計", t.subtotal);
  for (const g of t.groups)
    totalLine(`${g.rate}%対象 ${money(g.subtotal)} / 税`, g.tax);
  if (d.monthly) {
    totalLine("前回繰越額", d.monthly.previousBalance);
    totalLine("入金・相殺額", d.monthly.payment);
  }
  totalLine("合計（税込）", documentTotal(d), true);
  if (d.monthly) {
    y -= 12;
    block("対象伝票", 42, 510, 11);
    for (const o of d.monthly.orders)
      block(`${o.date}  ${o.number}  ${o.title}`, 42, 510, 9);
  }
  if (d.type.includes("請求") && d.company.bank) {
    ensure(65);
    y -= 10;
    rule();
    block("お振込先", 42, 510, 11);
    block(d.company.bank, 42, 510, 10);
  }
  const notes = [d.order.note, d.company.note].filter(Boolean).join("\n");
  if (notes) {
    ensure(65);
    y -= 10;
    rule();
    block("備考", 42, 510, 11);
    block(notes, 42, 510, 9);
  }
  pdf
    .getPages()
    .forEach((p, i) =>
      p.drawText(
        `MONORAL / ${number(row)} / ${i + 1} / ${pdf.getPageCount()}`,
        { x: 42, y: 28, size: 8, font, color: gray },
      ),
    );
  return pdf.save();
}
export async function downloadDocumentPdf(
  row: Row<DocumentData>,
  demo = false,
) {
  const response = await fetch("/fonts/NotoSansJP.otf");
  if (!response.ok) throw new Error("PDF用フォントを読み込めません");
  const bytes = await createDocumentPdf(
    row,
    new Uint8Array(await response.arrayBuffer()),
    demo,
  );
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${demo ? "SAMPLE-" : ""}${number(row)}-${row.data.type}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
