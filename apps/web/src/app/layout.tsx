import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Sora({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Orbitboard — Collaborative Infinite Canvas",
  description:
    "Real-time collaborative infinite canvas with physics, radar presence, offline sync, and time travel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <Script id="theme-boot" src="/theme-boot.js" strategy="beforeInteractive" />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
