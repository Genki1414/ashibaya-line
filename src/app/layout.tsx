import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "足場信用プラットフォーム",
    template: "%s ｜ 足場信用プラットフォーム",
  },
  description: "足場会社向け 信用プラットフォーム",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
  // iOS でホーム画面に追加したときにスタンドアロン表示＋プッシュ通知を有効化する。
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "足場信用",
  },
};

// スマホ画面に自動フィット（幅＝端末幅、初期倍率1、ノッチ対応）。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1657c9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
