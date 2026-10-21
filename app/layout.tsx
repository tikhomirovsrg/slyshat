import type { Metadata } from "next";
import "./globals.css";
import "./comic.css";

export const metadata: Metadata = {
  title: "Слышать — английский и итальянский в историях",
  description: "По 1000 интерактивных историй на английском и итальянском: комиксы с озвучкой, выбором действий и разными финалами. Проходи по порядку и сохраняй прогресс между устройствами.",
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
