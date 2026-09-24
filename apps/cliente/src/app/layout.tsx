import type { Metadata, Viewport } from "next";
import { Manrope, Oswald } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "Tostal — Sabores que unen culturas",
  description: "Pide postres de Tostal: menú del día, retiro o envío",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#9A2E25",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${oswald.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
