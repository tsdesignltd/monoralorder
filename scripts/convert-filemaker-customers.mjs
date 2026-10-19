import fs from "node:fs";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node scripts/convert-filemaker-customers.mjs INPUT.tab OUTPUT.json",
  );
// FileMaker export order: 顧客No,顧客名,部署名,担当者名,TEL,FAX,住所1,住所2,郵便番号.
const source = new TextDecoder("shift_jis").decode(fs.readFileSync(input));
const rows = source
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.split("\t"));
if (rows.some((r) => r.length !== 9))
  throw new Error(
    "Expected exactly 9 exported columns; check the export order.",
  );
const clean = (value) => value.replace(/[\x0b\x1d]/g, "\n").trim();
const customers = [],
  skipped = [];
for (const raw of rows) {
  const r = raw.map(clean);
  if (!r[1]) {
    skipped.push({ legacyId: r[0], reason: "顧客名が空欄" });
    continue;
  }
  customers.push({
    legacyId: r[0],
    name: r[1],
    contact: r[3],
    phone: r[4],
    fax: r[5],
    address: [r[6], r[7]].filter(Boolean).join("\n"),
    postal: r[8],
    email: "",
    category: "その他",
    note: [
      r[2] && `部署：${r[2]}`,
      "現行ソフトから移行。顧客カテゴリーは要確認。メールアドレスは未取得。",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
fs.writeFileSync(
  output,
  JSON.stringify({ format: "monoral-customers-v1", customers }, null, 2),
);
console.log(
  JSON.stringify(
    {
      exportedRows: rows.length,
      customers: customers.length,
      skipped,
      categoryReviewRequired: customers.length,
      emailNotExported: true,
    },
    null,
    2,
  ),
);
