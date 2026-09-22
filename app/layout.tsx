import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: {
    default: "Grinberg Rental Room",
    template: "%s · Grinberg Rental Room",
  },
  description:
    "Browse Grinberg Management rental vacancies, Matterport tours, and office notes from the vacancy sheet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-ink antialiased">
        <a
          href="#inventory"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2"
        >
          Skip to listings
        </a>
        <SiteHeader />
        <main id="inventory" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
