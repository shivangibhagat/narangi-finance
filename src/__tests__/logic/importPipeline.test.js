import { describe, it, expect } from "vitest";
import { fmtDateCell } from "../../utils/dateParser";

/**
 * Tests for the Excel import pipeline logic.
 * Covers the mapping from raw Excel rows → app transactions.
 */

// Simulate the row-to-transaction conversion used in ImportModal
function parseRow(row, mapping, fmtDate) {
  const get = (r, key) => key ? r[key] : undefined;

  const rawDate   = get(row, mapping.date);
  const rawAmt    = get(row, mapping.amount);
  const rawCat    = String(get(row, mapping.category)  || "").trim().toUpperCase();
  const rawSubCat = String(get(row, mapping.subCat)    || "").trim().toUpperCase();
  const rawPerson = String(get(row, mapping.person)    || "").trim().toUpperCase();
  const rawDesc   = String(get(row, mapping.spentOn)   || "").trim();

  const dateStr = fmtDate(rawDate);
  const amount  = parseFloat(String(rawAmt).replace(/[^0-9.]/g, "")) || 0;

  if (!dateStr || !amount) return null;

  return { date: dateStr, category: rawCat, subCat: rawSubCat, spentOn: rawDesc, amount, person: rawPerson, tags: [], note: "" };
}

const MAPPING = { date:"Date", amount:"Amount", category:"Category", subCat:"Sub-Category", person:"Person", spentOn:"Description" };
const PARSE_DATE = (v) => fmtDateCell(v, (serial) => {
  // Pure arithmetic — same logic as mockParseFn in dateParser tests
  const adj = serial > 60 ? serial - 1 : serial;
  const d = new Date(Date.UTC(1900,0,0) + adj * 86400000);
  return { y:d.getUTCFullYear(), m:d.getUTCMonth()+1, d:d.getUTCDate() };
});

describe("Excel row parsing — dates", () => {
  it("parses Excel serial 46143 as 2026-05-01", () => {
    const row = { Date:46143, Amount:68000, Category:"INCOME", "Sub-Category":"SALARY_NARR", Person:"NARR", Description:"Salary" };
    const txn = parseRow(row, MAPPING, PARSE_DATE);
    expect(txn.date).toBe("2026-05-01");
  });

  it("does NOT produce April 30 for May 1 serial (the IST -1 bug)", () => {
    const row = { Date:46143, Amount:1000, Category:"VARIABLE EXPENSES", "Sub-Category":"SHOPPING", Person:"NARR", Description:"Test" };
    const txn = parseRow(row, MAPPING, PARSE_DATE);
    expect(txn.date).not.toBe("2026-04-30");
    expect(txn.date).toBe("2026-05-01");
  });

  it("parses ISO string date", () => {
    const row = { Date:"2026-05-18", Amount:500, Category:"VARIABLE EXPENSES", "Sub-Category":"CAFES/RESTAURANTS", Person:"SHIVU", Description:"Coffee" };
    const txn = parseRow(row, MAPPING, PARSE_DATE);
    expect(txn.date).toBe("2026-05-18");
  });
});

describe("Excel row parsing — amounts", () => {
  it("parses integer amount",        () => {
    const row = { Date:46143, Amount:1590, Category:"FIXED EXPENSES", "Sub-Category":"LIGHTBILL", Person:"NARR", Description:"Light Bill" };
    expect(parseRow(row, MAPPING, PARSE_DATE).amount).toBe(1590);
  });

  it("parses float amount",          () => {
    const row = { Date:46143, Amount:1590.50, Category:"FIXED EXPENSES", "Sub-Category":"LIGHTBILL", Person:"NARR", Description:"x" };
    expect(parseRow(row, MAPPING, PARSE_DATE).amount).toBe(1590.5);
  });

  it("strips ₹ symbol from amount", () => {
    const row = { Date:46143, Amount:"₹1590", Category:"FIXED EXPENSES", "Sub-Category":"LIGHTBILL", Person:"NARR", Description:"x" };
    expect(parseRow(row, MAPPING, PARSE_DATE).amount).toBe(1590);
  });

  it("returns null for zero amount (skip row)", () => {
    const row = { Date:46143, Amount:0, Category:"FIXED EXPENSES", "Sub-Category":"LIGHTBILL", Person:"NARR", Description:"x" };
    expect(parseRow(row, MAPPING, PARSE_DATE)).toBeNull();
  });

  it("returns null for missing amount", () => {
    const row = { Date:46143, Amount:"", Category:"FIXED EXPENSES", "Sub-Category":"LIGHTBILL", Person:"NARR", Description:"x" };
    expect(parseRow(row, MAPPING, PARSE_DATE)).toBeNull();
  });
});

describe("Excel row parsing — category / subCat normalisation", () => {
  it("uppercases category", () => {
    const row = { Date:46143, Amount:1000, Category:"variable expenses", "Sub-Category":"shopping", Person:"NARR", Description:"x" };
    const txn = parseRow(row, MAPPING, PARSE_DATE);
    expect(txn.category).toBe("VARIABLE EXPENSES");
    expect(txn.subCat).toBe("SHOPPING");
  });

  it("trims whitespace from fields", () => {
    const row = { Date:46143, Amount:1000, Category:" FIXED EXPENSES ", "Sub-Category":" HOUSE RENT ", Person:" NARR ", Description:" Rent " };
    const txn = parseRow(row, MAPPING, PARSE_DATE);
    expect(txn.category).toBe("FIXED EXPENSES");
    expect(txn.subCat).toBe("HOUSE RENT");
    expect(txn.person).toBe("NARR");
    expect(txn.spentOn).toBe("Rent");
  });
});

describe("Excel row parsing — invalid rows", () => {
  it("returns null when date is missing", () => {
    const row = { Date:"", Amount:1000, Category:"INCOME", "Sub-Category":"SALARY_NARR", Person:"NARR", Description:"x" };
    expect(parseRow(row, MAPPING, PARSE_DATE)).toBeNull();
  });

  it("returns null when amount is 0", () => {
    const row = { Date:46143, Amount:0, Category:"INCOME", "Sub-Category":"SALARY_NARR", Person:"NARR", Description:"x" };
    expect(parseRow(row, MAPPING, PARSE_DATE)).toBeNull();
  });
});
