import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
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
      <head>
        {/*
          Stamps the stored theme onto <html> before first paint so the canvas and
          panels never flash the wrong palette. It has to be a plain blocking
          script in <head>: next/script's beforeInteractive strategy renders a
          script element inside the component tree, which React refuses to execute
          on the client and warns about.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-boot.js" />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
