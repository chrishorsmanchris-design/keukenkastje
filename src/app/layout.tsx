import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Keukenkastje",
  description: "Jouw slimme kookassistent",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Keukenkastje",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${geist.variable} h-full antialiased`} style={{ colorScheme: 'light' }}>
      <body className="min-h-full bg-stone-50 text-stone-900" style={{ colorScheme: 'light' }}>{children}</body>
    </html>
  );
}
