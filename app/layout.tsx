import ThemeSelector from "./components/theme-selector";
import {THEME_BOOTSTRAP} from "@/lib/theme";
import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.localagendawatch.com"),
  title: {
    default: "Local Agenda Watch",
    template: "%s · Local Agenda Watch",
  },
  description:
    "Public awareness of local government decisions — land development, rezoning, and municipal items — before they happen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head><script id="law-theme" dangerouslySetInnerHTML={{__html:THEME_BOOTSTRAP}}/></head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-black dark:bg-black dark:text-zinc-50">
        <header className="border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-black/60">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              Local Agenda Watch
            </Link>
            <ThemeSelector/>
          </div>
        </header>
        {children}
        <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
          <div className="mx-auto w-full max-w-5xl px-6 py-8 text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              &copy; {new Date().getFullYear()} Local Agenda Watch. Independent
              public-awareness project.
            </p>
            <nav aria-label="Site information" className="mt-4 flex gap-5">
              <Link href="/about" className="underline underline-offset-4">About</Link>
              <Link href="/contact" className="underline underline-offset-4">Contact</Link>
              <Link href="/privacy" className="underline underline-offset-4">Privacy</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
