import type { Metadata } from "next";
import "./globals.css";
import "./comic.css";
import "./comic-novel.css";
import "./story-learning.css";

export const metadata: Metadata = {
  title: "Слышать — английский и итальянский в историях",
  description: "Английский и итальянский в историях A1–C1: читай диалоги, слушай доступные записи, выбирай продолжение и проверяй понимание. Прогресс сохраняется между устройствами.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
