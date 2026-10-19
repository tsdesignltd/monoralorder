import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MONORAL | 販売管理",
  description: "顧客・商品・受注・帳票をひとつの場所に。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
