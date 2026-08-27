import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Davomat 1.0",
  description:
    "Maktablarda o'quvchilar davomatini QR kod orqali avtomatlashtirilgan tarzda yuritish tizimi.",
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" className="h-full antialiased">
      <body className={`min-h-full bg-background text-foreground ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
