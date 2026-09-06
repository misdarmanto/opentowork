import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";

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
      <body className="min-h-full flex flex-col bg-muted/30">
        <Providers>
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
            <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                    OW
                  </span>
                  Open Work
                </Link>
                <div className="flex items-center gap-1">
                  <NavLink href="/">Dashboard</NavLink>
                  <NavLink href="/workflows">Workflows</NavLink>
                </div>
              </div>
              <Button size="sm" nativeButton={false} render={<Link href="/workflows/new" />}>
                New workflow
              </Button>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
          <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
            Open Work — self-hosted, AGPL-3.0
          </footer>
        </Providers>
      </body>
    </html>
  );
}
