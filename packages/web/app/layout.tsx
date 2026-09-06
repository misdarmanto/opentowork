import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Open Work",
  description: "Build and run teams of AI agents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="border-b border-black/10 dark:border-white/10">
            <nav className="mx-auto max-w-4xl flex items-center gap-6 px-4 py-3 text-sm">
              <Link href="/" className="font-semibold">
                Open Work
              </Link>
              <Link href="/workflows">Workflows</Link>
              <Link href="/workflows/new">New Workflow</Link>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
