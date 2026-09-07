import { describe, expect, it } from "vitest";
import { ANSWERS, matchHelpAnswer } from "./helpAnswers";

describe("matchHelpAnswer", () => {
  it("matches price questions", () => {
    expect(matchHelpAnswer("How much does it cost?").id).toBe("price");
  });

  it("matches apartment and landlord questions", () => {
    expect(matchHelpAnswer("Can I show records to my landlord for my apartment?").id).toBe(
      "apartment",
    );
  });

  it("matches vet record questions", () => {
    expect(matchHelpAnswer("How do I upload vet records?").id).toBe("vet");
  });

  it("matches share and passport questions", () => {
    expect(matchHelpAnswer("How do I share a passport QR code?").id).toBe("share");
  });

  it("matches reminder and vaccine due questions", () => {
    expect(matchHelpAnswer("When is the next vaccine due?").id).toBe("reminders");
  });

  it("matches insurance claim questions", () => {
    expect(matchHelpAnswer("How do I file an insurance claim?").id).toBe("insurance");
  });

  it("matches travel and flight questions", () => {
    expect(matchHelpAnswer("Can I fly on a flight for travel?").id).toBe("travel");
  });

  it("matches groomer and boarding questions", () => {
    expect(matchHelpAnswer("What do groomers need for boarding?").id).toBe("groomer");
  });

  it("matches cancel and refund questions", () => {
    expect(matchHelpAnswer("How do I cancel and get a refund?").id).toBe("cancel");
  });

  it("matches magic link sign in questions", () => {
    expect(matchHelpAnswer("How does magic link sign in work?").id).toBe("signin");
  });

  it("matches security and privacy questions", () => {
    expect(matchHelpAnswer("Is my data private and secure?").id).toBe("security");
  });

  it("matches contact human questions", () => {
    expect(matchHelpAnswer("Can I talk to a human?").id).toBe("contact");
  });

  it("falls back to contact for unknown input", () => {
    expect(matchHelpAnswer("blorp zzzqqq fjord").id).toBe("contact");
  });

  it("falls back to contact for empty input", () => {
    expect(matchHelpAnswer("").id).toBe("contact");
    expect(matchHelpAnswer("   ").id).toBe("contact");
  });

  it("matches case-insensitively", () => {
    expect(matchHelpAnswer("PRICE COST").id).toBe("price");
    expect(matchHelpAnswer("APARTMENT LANDLORD").id).toBe("apartment");
  });

  it("breaks apartment plus price ties by first answer", () => {
    expect(matchHelpAnswer("apartment price").id).toBe("price");
    expect(ANSWERS.findIndex((a) => a.id === "price")).toBeLessThan(
      ANSWERS.findIndex((a) => a.id === "apartment"),
    );
  });
});
