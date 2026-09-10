import { describe, it, expect } from "vitest";
import { fmt, uid, mNum, monthKey, ccKey } from "../../utils/format";

describe("fmt() — Indian number formatting", () => {
  it("formats zero as ₹0",        () => expect(fmt(0)).toBe("₹0"));
  it("formats hundreds",           () => expect(fmt(500)).toBe("₹500"));
  it("formats thousands",          () => expect(fmt(1000)).toBe("₹1,000"));
  it("formats ten-thousand",       () => expect(fmt(10000)).toBe("₹10,000"));
  it("formats one lakh",           () => expect(fmt(100000)).toBe("₹1,00,000"));
  it("formats ten lakhs",          () => expect(fmt(1000000)).toBe("₹10,00,000"));
  it("handles null gracefully",    () => expect(fmt(null)).toBe("₹0"));
  it("handles undefined gracefully", () => expect(fmt(undefined)).toBe("₹0"));
  it("handles string numbers",     () => expect(fmt("5000")).toBe("₹5,000"));
  it("handles negative values",    () => expect(fmt(-1000)).toBe("-₹1,000"));
});

describe("mNum() — month name to 2-digit number", () => {
  it("Jan → 01",   () => expect(mNum("Jan")).toBe("01"));
  it("May → 05",       () => expect(mNum("May")).toBe("05"));
  it("Oct → 10",   () => expect(mNum("Oct")).toBe("10"));
  it("Dec → 12",  () => expect(mNum("Dec")).toBe("12"));
  it("Jun → 06",      () => expect(mNum("Jun")).toBe("06"));
});

describe("monthKey()", () => {
  it("2026 May → 2026-05",      () => expect(monthKey(2026, "May")).toBe("2026-05"));
  it("2026 Jan → 2026-01",  () => expect(monthKey(2026, "Jan")).toBe("2026-01"));
  it("2026 Dec → 2026-12", () => expect(monthKey(2026, "Dec")).toBe("2026-12"));
});

describe("ccKey()", () => {
  it("cc1 2026 May → cc1_2026-05",
    () => expect(ccKey("cc1", 2026, "May")).toBe("cc1_2026-05"));
  it("cc2 2026 Jan → cc2_2026-01",
    () => expect(ccKey("cc2", 2026, "Jan")).toBe("cc2_2026-01"));
});

describe("fmt() — corner cases", () => {
  it("handles NaN as ₹0",          () => expect(fmt(NaN)).toBe("₹0"));
  it("handles numeric strings",    () => expect(fmt("12345")).toBe("₹12,345"));
  it("handles garbage strings",    () => expect(fmt("abc")).toBe("₹0"));
  it("handles floats",             () => expect(fmt(1500.5)).toBe("₹1,500.5"));
  it("handles large values",       () => expect(fmt(10000000)).toBe("₹1,00,00,000"));
});

describe("mNum() — corner cases", () => {
  it("unknown month → '00' (never crashes)", () => expect(mNum("Foo")).toBe("00"));
  it("empty → '00'", () => expect(mNum("")).toBe("00"));
});

describe("uid() — unique ID generator", () => {
  it("returns a string",           () => expect(typeof uid()).toBe("string"));
  it("is never empty",             () => expect(uid().length).toBeGreaterThan(0));
  it("generates unique IDs",       () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
  it("stays unique across a bulk import (1000 rapid calls)", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uid()));
    expect(ids.size).toBe(1000);
  });
});
