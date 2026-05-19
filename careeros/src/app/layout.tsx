import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { TrpcProvider } from "@/components/providers/trpc-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { UtmCaptureRoot } from "@/components/utm-capture-root";
import {
  PRODUCT_NAME,
  PRODUCT_ORIGIN,
  PRODUCT_TAGLINE,
} from "@/lib/brand";
import { getCareerosPublicHost } from "@/lib/projectsUrls";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${getCareerosPublicHost()}`),
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: PRODUCT_TAGLINE,
  applicationName: PRODUCT_NAME,
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: PRODUCT_ORIGIN,
    siteName: PRODUCT_NAME,
    title: PRODUCT_NAME,
    description: PRODUCT_TAGLINE,
  },
  twitter: {
    card: "summary_large_image",
    title: PRODUCT_NAME,
    description: PRODUCT_TAGLINE,
  },
  alternates: {
    canonical: PRODUCT_ORIGIN,
  },
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
      className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <TrpcProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <UtmCaptureRoot />
              {children}
              <Toaster />
            </ThemeProvider>
          </TrpcProvider>
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  );
}
