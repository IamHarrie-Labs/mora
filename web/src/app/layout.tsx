import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Mora — a time-delay safe for your crypto",
  description:
    "If your key leaks or someone forces your hand at 2 AM, nothing big leaves before morning, and your guardians can send it all home. On Base.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-20">{children}</main>
          <footer className="border-t border-line py-6 text-center text-xs text-muted px-4">
            Mora · built for Vibestarter Vibeathon 02 · testnet prototype, unaudited ·{" "}
            <a className="underline" href="https://github.com/iamharrie-labs/mora">source</a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
