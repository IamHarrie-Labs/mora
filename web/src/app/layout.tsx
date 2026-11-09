import type { Metadata } from "next";
import { JetBrains_Mono, Lexend, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const head = Outfit({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-head" });
const body = Lexend({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-body" });
const code = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-code" });

export const metadata: Metadata = {
  title: "Mora · a time-delay vault for your crypto",
  description:
    "Large transfers wait in a queue, and people you trust can stop them while they wait. A self-custody vault on Base.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
