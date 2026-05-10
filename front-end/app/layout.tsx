import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Header } from "@/components/header";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Stok Market — Bet on what's next",
  description:
    "Permissionless binary prediction markets. Bet on real-world events. Settle on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <Providers>
          <div className="relative">
            <div className="pointer-events-none fixed inset-x-0 top-0 h-[60vh] grid-bg opacity-40 [mask-image:linear-gradient(180deg,#000,transparent)]" />
            <Header />
            <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#11131C",
                color: "#E6E7EB",
                border: "1px solid #252836",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
