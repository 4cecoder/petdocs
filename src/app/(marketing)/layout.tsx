import type { Metadata } from "next";
import { HelpWidget } from "@/components/chat/HelpWidget";

export const metadata: Metadata = {
  title: "petdocs: Own your pet's docs",
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <HelpWidget />
    </>
  );
}
