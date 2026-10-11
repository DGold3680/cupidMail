import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { PWAProvider } from "@/components/PWAProvider";

const spaceMono = localFont({
  src: "./fonts/SpaceMono-Regular.ttf",
  variable: "--font-space-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#881337",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Cupid Mail - Private Multi-Domain Email",
  description: "Private, delightful, serverless email platform powered by Cloudflare, Cloudinary, and Resend",
  manifest: "/manifest.json",
  applicationName: "Cupid Mail",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cupid Mail",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceMono.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Cupid Mail" />
      </head>
      <body className="antialiased min-h-screen bg-[#FAF7F2] text-[#2A221F] selection:bg-rose-200 selection:text-rose-950 font-sans safe-paddings">
        <PWAProvider>{children}</PWAProvider>
      </body>
    </html>
  );
}
