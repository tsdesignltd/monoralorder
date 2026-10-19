# MONORAL 販売管理

顧客・商品・受注・帳票を管理する、日本語のWebアプリです。
ソース保存先: https://github.com/tsdesignltd/monoralorder

## 実装済み

- 顧客の登録・編集・検索・4カテゴリー（アウトドアショップ / 自転車店 / 代理店 / その他）
- FileMakerの顧客書き出しデータを変換し、旧顧客番号で重複を避けて取り込む
- 商品コード・定価・単位・税率を管理
- 卸販売 / サンプル販売 / 返品処理 / 保証交換の受注伝票
- 伝票単位の仕切り率（0〜100%、小数第2位まで）
- 見積書 / 納品書 / 単体請求書 / 納品請求書 / 月締め合計請求書
- 日本語フォントを埋め込んだPDFの直接ダウンロード、印刷、複数ページ対応
- 発行済み帳票のスナップショット保存
- 請求済みの伝票を月締めから除外し、DBの一意制約で二重請求を防止
- Supabase認証、事務所・倉庫の共有データ、編集の競合検知
- JSONバックアップ書き出し、スマートフォン対応

## GitHub Pages版

画面はGitHub Pages、APIはSupabase Edge Functions `monoral-api`、認証はSupabase Authです。ChatGPTログインは使いません。
事務所ID `monoral`、倉庫ID `monoralorder` を内部認証識別子に変換してログインします。メール送信を使わないID方式なので、パスワード紛失時は管理者が再設定します。
両アカウントは `monoral_members` の登録によって共通ワークスペース `monoral` に接続します。新規登録しただけのアカウントには業務データへの権限がありません。

- `npm run build:pages`: 静的画面を `dist-pages` に生成
- `npm run build:edge`: APIソース `edge/` を単一ファイルに生成
- GitHub Settings → Pages → Source を GitHub Actions に設定
- Edge Functionは内部でAuthサーバーに本人確認し、メンバー表を照合します。旧JWT共有秘密鍵の検証は使用しません。
- `SUPABASE_SERVICE_ROLE_KEY` はEdge Function内だけで使用します。画面には公開可能キーのみを含めます。
- 初期スキーマは `supabase/001_monoral.sql`、共有アクセス用は `supabase/shared-access.sql`。メンバー追加は管理者のみ実行します。
- 旧ChatGPT Sitesのサーバールートは移行参照用です。現在のAPIソースは `edge/handlers` です。

Supabaseでは業務テーブルのRLSを有効にし、ブラウザからの直接操作を禁止しています。受注のバージョンによる上書き防止と、請求伝票の一意制約を維持しています。
発行済み帳票は商品・顧客・自社情報のコピーを保存します。顧客・2026年販売データの移行は別工程です。

## 顧客の移行

現行FileMakerからタブ区切り・Shift-JISで、次の順序で書き出します。

`顧客No / 顧客名 / 部署名 / 担当者名 / TEL / FAX / 住所1 / 住所2 / 郵便番号`

```sh
node scripts/convert-filemaker-customers.mjs /private/customers.tab /private/customers-import.json
```

顧客画面の取り込み欄でJSONを選択し、件数を確認して追加します。同じ旧顧客番号はスキップします。
顧客名が空欄の行は変換時に除外・報告します。メールアドレスは上記書き出しに含まれません。
カテゴリーは推測せず「その他」で取り込み、移行後に確認・変更してください。
実顧客データ・請求情報・秘密キーは、このリポジトリに含めないでください。

## 金額・帳票の扱い

- 税抜単価 = 定価 × 仕切り率。単価の1円未満を切り捨て。
- 税額 = 税率ごとの税抜合計から算出。1円未満をゼロ方向へ切り捨て。
- 返品処理では数量入力は正数のまま、金額をマイナスで計算。
- 月締めは月末締め。納品予定日（空欄なら受注日）が対象月の、受注確定・出荷済・完了の伝票が対象。
- 単体請求書 / 納品請求書 / 合計請求書で請求済みの受注は、再請求できません。帳票一覧から既存帳票を再出力してください。
- 合計請求書は税率別の税抜金額を月単位で合算して税計算するため、各伝票の税込金額の単純合計と端数差が出る場合があります。
- 前回繰越額と入金・相殺額は月締め作成時に入力します。自動の入金照合は含みません。
- 発行済み帳票の取消・訂正、締め日変更、請求先と納品先の分離、過去受注移行は今後の拡張です。

## 開発

Node.js 22.13以上。

```sh
npm ci
npm run dev
npm run build
npm test
```

Vinext + React + Cloudflare Workersの構成です。Sitesの認証とビルド統合を維持してください。
開発時のローカル認証はスターターが提供します。本番ではホストが認証情報を付与します。
別ホストに配置する場合は、認証境界を実装してから運用してください。未認証のユーザー指定ヘッダーを信用するプロキシ構成にしないでください。

## 検証

型検査、ビルド、仕切り率・返品・月次税額・繰越の計算テスト、5種類のPDFと60行の複数ページPDFを用意しています。
PDFテストの出力は `.sites-runtime/pdf-qa/` に保存され、Git管理対象外です。
Supabaseの実環境との結合テストは、プロジェクト作成・接続後に実施してください。

## フォント

PDF: Noto Sans CJK JP Regular / SIL Open Font License 1.1。
Source: https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf
ライセンスは `public/fonts/OFL.txt` に同梱。Web表示はDM Sans / Noto Sans JPを使用。

