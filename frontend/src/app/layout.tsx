import 'temporal-polyfill/global';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../styles/globals.scss';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '401予約管理システム',
  description: '401という部屋の予約の管理システム',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      {/* ブラウザ拡張 (ColorZilla 等) が body に cz-shortcut-listen 等の属性を
          注入し、サーバ HTML と差分が出てハイドレーションが落ちるのを防ぐ。
          suppressHydrationWarning は body 自身の属性差分のみ抑制し、子要素の
          本当のミスマッチは検知されたまま。 */}
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
