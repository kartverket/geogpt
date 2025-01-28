"use client";
import "./globals.css";
import { Inter } from "next/font/google";

// Load Inter font with specific weights
const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter", // Add a CSS variable for the font
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="https://kartkatalog.geonorge.no/favicon.ico" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
