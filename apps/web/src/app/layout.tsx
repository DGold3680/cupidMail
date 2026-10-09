import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const spaceMono = localFont({
  src: "./fonts/SpaceMono-Regular.ttf",
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cupid Mail - Private Multi-Domain Email",
  description: "Private, delightful, serverless email platform powered by Cloudflare, Cloudinary, and Resend",
  icons: {
    icon: "/assets/Logo.png",
    shortcut: "/assets/Logo.png",
    apple: "/assets/Logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceMono.variable}>
      <body className="antialiased min-h-screen bg-[#FAF7F2] text-[#2A221F] selection:bg-rose-200 selection:text-rose-950 font-sans">
        {children}
      </body>
    </html>
  );
}


