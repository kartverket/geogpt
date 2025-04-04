"use client";
import "./globals.css";
import { Inter } from "next/font/google";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { TourProvider } from "@/components/tour";
import { Toaster } from "@/components/ui/sonner";

// Load Inter font with specific weights
const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="https://kartkatalog.geonorge.no/favicon.ico" />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          <TourProvider>
            {children}
            <Toaster position="bottom-center" />
          </TourProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
