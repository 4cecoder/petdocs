import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact | petdocs",
  description:
    "Questions about petdocs? Send us a message and we'll get back to you.",
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-6 pb-20 pt-28">
        <h1 className="text-center font-display text-3xl font-bold">
          Get in touch
        </h1>
        <p className="mt-2 text-center text-ink-soft">
          Questions, feedback, or trouble with your account — we read
          everything.
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
