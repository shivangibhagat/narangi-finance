import { describe, it, expect } from "vitest";
import {
  parseImportAmount,
  normalizeCategory,
  maybeConvertCCPayment,
  normalizeSubCatName,
  txnDedupeKey,
  autoDetectMapping,
} from "../../utils/importer";

describe("parseImportAmount()", () => {
  it("passes numbers through", () => {
    expect(parseImportAmount(1590)).toBe(1590);
    expect(parseImportAmount(1590.5)).toBe(1590.5);
    expect(parseImportAmount(0)).toBe(0);
  });
  it("keeps negative numbers (filtered out later by amount > 0)", () => {
    expect(parseImportAmount(-500)).toBe(-500);
    expect(parseImportAmount("-500")).toBe(-500);
  });
  it("strips ₹ symbol", () => expect(parseImportAmount("₹1590")).toBe(1590));
  it("strips commas", () => expect(parseImportAmount("1,00,000")).toBe(100000));
  it("strips ₹ + commas + decimals", () => expect(parseImportAmount("₹1,590.50")).toBe(1590.5));
  it("strips whitespace", () => expect(parseImportAmount("  2 500 ")).toBe(2500));
  it("strips Rs. prefix (common in bank statements)", () => {
    expect(parseImportAmount("Rs. 1500")).toBe(1500);
    expect(parseImportAmount("Rs.1500")).toBe(1500);
    expect(parseImportAmount("rs 1500")).toBe(1500);
  });
  it("strips INR / rupees prefixes", () => {
    expect(parseImportAmount("INR 2000")).toBe(2000);
    expect(parseImportAmount("Rupees 750")).toBe(750);
  });
  it("returns 0 for garbage (row gets skipped)", () => {
    expect(parseImportAmount("abc")).toBe(0);
    expect(parseImportAmount("(500)")).toBe(0);
    expect(parseImportAmount("")).toBe(0);
    expect(parseImportAmount(null)).toBe(0);
    expect(parseImportAmount(undefined)).toBe(0);
  });
  it("returns 0 for NaN / Infinity", () => {
    expect(parseImportAmount(NaN)).toBe(0);
    expect(parseImportAmount(Infinity)).toBe(0);
  });
});

describe("normalizeCategory()", () => {
  it("passes canonical names through", () => {
    expect(normalizeCategory("INCOME")).toBe("INCOME");
    expect(normalizeCategory("FIXED EXPENSES")).toBe("FIXED EXPENSES");
    expect(normalizeCategory("VARIABLE EXPENSES")).toBe("VARIABLE EXPENSES");
    expect(normalizeCategory("SAVINGS")).toBe("SAVINGS");
    expect(normalizeCategory("CC PAYMENT")).toBe("CC PAYMENT");
  });
  it("maps short forms", () => {
    expect(normalizeCategory("FIXED")).toBe("FIXED EXPENSES");
    expect(normalizeCategory("VARIABLE")).toBe("VARIABLE EXPENSES");
    expect(normalizeCategory("SAVING")).toBe("SAVINGS");
    expect(normalizeCategory("CC")).toBe("CC PAYMENT");
  });
  it("is case- and whitespace-insensitive", () => {
    expect(normalizeCategory("  fixed expenses ")).toBe("FIXED EXPENSES");
    expect(normalizeCategory("income")).toBe("INCOME");
    expect(normalizeCategory("Cc Payment")).toBe("CC PAYMENT");
  });
  it("falls back to first word, then VARIABLE EXPENSES", () => {
    expect(normalizeCategory("FIXED DEPOSIT")).toBe("FIXED EXPENSES"); // first-word hit
    expect(normalizeCategory("SOMETHING WEIRD")).toBe("VARIABLE EXPENSES");
    expect(normalizeCategory("")).toBe("VARIABLE EXPENSES");
    expect(normalizeCategory(null)).toBe("VARIABLE EXPENSES");
    expect(normalizeCategory(undefined)).toBe("VARIABLE EXPENSES");
  });
});

describe("maybeConvertCCPayment()", () => {
  it("converts VARIABLE + CREDIT CARD subCat → CC PAYMENT", () => {
    expect(maybeConvertCCPayment("VARIABLE EXPENSES", "CREDIT CARD BILLS")).toBe("CC PAYMENT");
    expect(maybeConvertCCPayment("VARIABLE EXPENSES", "HDFC CREDIT CARD")).toBe("CC PAYMENT");
  });
  it("converts VARIABLE + CC BILL subCat → CC PAYMENT", () => {
    expect(maybeConvertCCPayment("VARIABLE EXPENSES", "CC BILL MAY")).toBe("CC PAYMENT");
  });
  it("leaves non-variable categories alone", () => {
    expect(maybeConvertCCPayment("FIXED EXPENSES", "CREDIT CARD BILLS")).toBe("FIXED EXPENSES");
    expect(maybeConvertCCPayment("INCOME", "CREDIT CARD")).toBe("INCOME");
  });
  it("leaves ordinary variable rows alone", () => {
    expect(maybeConvertCCPayment("VARIABLE EXPENSES", "SHOPPING")).toBe("VARIABLE EXPENSES");
    expect(maybeConvertCCPayment("VARIABLE EXPENSES", "")).toBe("VARIABLE EXPENSES");
    expect(maybeConvertCCPayment("VARIABLE EXPENSES", null)).toBe("VARIABLE EXPENSES");
  });
});

describe("normalizeSubCatName()", () => {
  it("trims and uppercases", () => {
    expect(normalizeSubCatName("  shopping ")).toBe("SHOPPING");
    expect(normalizeSubCatName("House Rent")).toBe("HOUSE RENT");
  });
  it("preserves unknown values (never drops data)", () => {
    expect(normalizeSubCatName("Some New Thing")).toBe("SOME NEW THING");
  });
  it("handles null/undefined", () => {
    expect(normalizeSubCatName(null)).toBe("");
    expect(normalizeSubCatName(undefined)).toBe("");
    expect(normalizeSubCatName("")).toBe("");
  });
});

describe("txnDedupeKey()", () => {
  it("builds date|amount|description key", () => {
    expect(txnDedupeKey({ date: "2026-05-01", amount: 500, spentOn: "Coffee" }))
      .toBe("2026-05-01|500|coffee");
  });
  it("is tolerant of case/whitespace/amount-type differences", () => {
    const a = txnDedupeKey({ date: "2026-05-01", amount: 500, spentOn: "Coffee" });
    const b = txnDedupeKey({ date: "2026-05-01", amount: "500", spentOn: "  COFFEE " });
    expect(a).toBe(b);
  });
  it("distinguishes genuinely different transactions", () => {
    const a = txnDedupeKey({ date: "2026-05-01", amount: 500, spentOn: "Coffee" });
    expect(txnDedupeKey({ date: "2026-05-02", amount: 500, spentOn: "Coffee" })).not.toBe(a);
    expect(txnDedupeKey({ date: "2026-05-01", amount: 600, spentOn: "Coffee" })).not.toBe(a);
    expect(txnDedupeKey({ date: "2026-05-01", amount: 500, spentOn: "Tea" })).not.toBe(a);
  });
});

describe("autoDetectMapping()", () => {
  it("detects standard headers", () => {
    const m = autoDetectMapping(["Date", "Category", "Sub-Category", "Description", "Amount", "Person", "Note"]);
    expect(m).toEqual({ date: 0, category: 1, subCat: 2, spentOn: 3, amount: 4, person: 5, note: 6 });
  });
  it("detects real-world header variants", () => {
    const m = autoDetectMapping(["Txn Date", "Particulars", "Debit", "Paid By"]);
    expect(m.date).toBe(0);       // "txndate" contains "date"
    expect(m.spentOn).toBe(1);    // "particulars" contains "particular"
    expect(m.person).toBe(3);     // "paidby" contains "paid"
  });
  it("detects amount variants", () => {
    expect(autoDetectMapping(["Amount (INR)"]).amount).toBe(0);
    expect(autoDetectMapping(["Rs"]).amount).toBe(0);
    expect(autoDetectMapping(["Value"]).amount).toBe(0);
  });
  it("maps 'Sub Category' to subCat, not category", () => {
    const m = autoDetectMapping(["Sub Category"]);
    expect(m.subCat).toBe(0);
    expect(m.category).toBe(-1);
  });
  it("maps 'Description' to spentOn, not note", () => {
    const m = autoDetectMapping(["Description"]);
    expect(m.spentOn).toBe(0);
    expect(m.note).toBe(-1);
  });
  it("returns -1 for unrecognized headers", () => {
    const m = autoDetectMapping(["Foo", "Bar", "", null]);
    expect(m).toEqual({ date: -1, category: -1, subCat: -1, spentOn: -1, amount: -1, person: -1, note: -1 });
  });
  it("handles empty / missing header list", () => {
    expect(autoDetectMapping([]).date).toBe(-1);
    expect(autoDetectMapping(null).amount).toBe(-1);
    expect(autoDetectMapping(undefined).note).toBe(-1);
  });
  it("first match wins for repeated headers", () => {
    const m = autoDetectMapping(["Date", "Date"]);
    expect(m.date).toBe(0);
  });
});
