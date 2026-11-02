import type { Metadata, Viewport } from "next";
import { Bungee, Cormorant } from "next/font/google";
import Footer from "@/components/Footer";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

// Cormorant for all text; Bungee only for the "Haystack" title.
const cormorant = Cormorant({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-serif" });
const bungee = Bungee({ subsets: ["latin"], weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Five images. Four are real photos, one was made by AI. Can you find it?",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${bungee.variable}`}>
      <body>
        <main className="page">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
