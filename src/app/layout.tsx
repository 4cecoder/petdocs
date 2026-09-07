import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
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

export const metadata: Metadata = {
  title: "petdocs — Own your pet's docs",
  description:
    "One vault for every pet document: vaccines, labs, prescriptions, insurance, travel certs. Share a pet passport with your vet, groomer, or boarder in seconds.",
  openGraph: {
    title: "petdocs — Own your pet's docs",
    description:
      "Upload once, prove vaccination in under 30 seconds, never miss a booster.",
    type: "website",
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
        {children}
      </body>
    </html>
  );
}
