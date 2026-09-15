import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  preload: true,
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  preload: false,
});

const SITE_URL = "https://petdocs.seridian.dev";

const SITE_TITLE = "petdocs: Own your pet's docs";
const SITE_DESCRIPTION =
  "One vault for every pet document: vaccines, labs, prescriptions, insurance, travel certs. Share a pet passport with your vet, groomer, or boarder in seconds.";
const OG_DESCRIPTION =
  "Upload once, prove vaccination in under 30 seconds, never miss a booster.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "petdocs",
  openGraph: {
    title: SITE_TITLE,
    description: OG_DESCRIPTION,
    url: "/",
    siteName: "petdocs",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "petdocs: own your pet's docs. Never miss a booster.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: OG_DESCRIPTION,
    images: ["/og.png"],
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
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${nunito.variable} ${inter.variable} antialiased`}
    >
      <body className="min-h-screen bg-cream font-sans text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
