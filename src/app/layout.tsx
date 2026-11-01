import type { Metadata, Viewport } from "next";
import { PT_Serif } from "next/font/google";
import Footer from "@/components/Footer";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const ptSerif = PT_Serif({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Five images. Some are real, some are AI. Can you tell?",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={ptSerif.variable}>
      <body>
        <main className="page">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
