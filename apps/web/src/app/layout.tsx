import type { Metadata, Viewport } from "next";
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "A real-time collaborative infinite canvas. Sketch, drop sticky notes, images and voice clips, throw objects with real physics, and replay the whole session — with live cursors and offline sync.";

export const metadata: Metadata = {
  // Resolves relative Open Graph and canonical URLs.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Orbitboard — Collaborative Infinite Canvas",
    // Room pages set only their own name; the brand is appended here.
    template: "%s · Orbitboard",
  },
  description: DESCRIPTION,
  applicationName: "Orbitboard",
  keywords: [
    "collaborative whiteboard",
    "infinite canvas",
    "real-time collaboration",
    "CRDT",
    "physics canvas",
    "online whiteboard",
  ],
  authors: [{ name: "Orbitboard" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Orbitboard",
    title: "Orbitboard — Collaborative Infinite Canvas",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbitboard — Collaborative Infinite Canvas",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  // The canvas fills the screen and handles its own gestures, so browser
  // pinch-zoom on the chrome would fight it.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1419" },
  ],
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
