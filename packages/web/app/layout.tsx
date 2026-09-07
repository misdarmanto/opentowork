import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/sidebar";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// The UI font is the system font stack (see --font-sans in globals.css),
// matching claude.ai's own fallback chain - Geist_Mono is kept for code/pre
// blocks, which claude.ai's fallback stack doesn't cover.
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
      suppressHydrationWarning
      className={`${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored theme before first paint - without this the page
            flashes light, then switches to dark once React hydrates. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full bg-muted/30">
        <Providers>
          <div className="flex h-full">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
