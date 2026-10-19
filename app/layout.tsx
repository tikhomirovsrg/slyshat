import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Слышать — английский и итальянский в историях",
  description: "40 интерактивных историй на английском и итальянском. Слушай, разбирай фразы, выбирай продолжение разговора и сохраняй прогресс между устройствами.",
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
