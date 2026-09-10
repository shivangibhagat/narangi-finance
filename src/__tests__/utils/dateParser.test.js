import { describe, it, expect } from "vitest";
import { fmtDateCell } from "../../utils/dateParser";

// Mock parseFn replaces XLSX.SSF.parse_date_code (timezone-safe arithmetic)
const mockParseFn = (serial) => {
  // Minimal Excel serial → {y,m,d} — handles serials from 1900 to 2100
  const adjusted = serial > 60 ? serial - 1 : serial; // Excel 1900 leap-year bug
  const epoch = Date.UTC(1900, 0, 0); // Dec 31 1899 UTC
  const ts = epoch + adjusted * 86400000;
  const d = new Date(ts);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};

describe("fmtDateCell() — null / empty", () => {
  it("returns '' for null",      () => expect(fmtDateCell(null)).toBe(""));
  it("returns '' for undefined", () => expect(fmtDateCell(undefined)).toBe(""));
  it("returns '' for ''",        () => expect(fmtDateCell("")).toBe(""));
});

describe("fmtDateCell() — string corner cases", () => {
  it("accepts non-padded ISO '2026-5-1'", () =>
    expect(fmtDateCell("2026-5-1")).toBe("2026-05-01"));

  it("defaults ambiguous 01/02/2026 to DD/MM/YYYY (Indian convention)", () =>
    expect(fmtDateCell("01/02/2026")).toBe("2026-02-01"));

  it("resolves first>12 as DD/MM/YYYY", () =>
    expect(fmtDateCell("25/12/2026")).toBe("2026-12-25"));

  it("resolves second>12 as MM/DD/YYYY", () =>
    expect(fmtDateCell("12/25/2026")).toBe("2026-12-25"));

  it("expands 2-digit years to 20xx", () =>
    expect(fmtDateCell("5/1/26")).toBe("2026-01-05"));

  it("returns '' for garbage strings", () => {
    expect(fmtDateCell("not a date")).toBe("");
    expect(fmtDateCell("2026")).toBe("");
    expect(fmtDateCell("12-25")).toBe("");
  });

  it("returns '' for serials without a parseFn", () =>
    expect(fmtDateCell(46143)).toBe(""));

  it("returns '' when parseFn throws", () =>
    expect(fmtDateCell(46143, () => { throw new Error("bad"); })).toBe(""));

  it("returns '' for unsupported types", () => {
    expect(fmtDateCell({})).toBe("");
    expect(fmtDateCell([])).toBe("");
    expect(fmtDateCell(true)).toBe("");
  });
});

describe("fmtDateCell() — Excel serial numbers (no timezone bug)", () => {
  it("serial 46143 → 2026-05-01 (May 1 2026)", () =>
    expect(fmtDateCell(46143, mockParseFn)).toBe("2026-05-01"));

  it("serial 44927 → 2023-01-01 (Jan 1 2023)", () =>
    expect(fmtDateCell(44927, mockParseFn)).toBe("2023-01-01"));

  it("serial 46160 → 2026-05-18 (May 18 2026)", () =>
    expect(fmtDateCell(46160, mockParseFn)).toBe("2026-05-18"));

  it("serial 46165 → 2026-05-23 (May 23 2026)", () =>
    expect(fmtDateCell(46165, mockParseFn)).toBe("2026-05-23"));

  it("never shifts to previous day (IST timezone bug)", () => {
    // This was the original bug: May 1 would appear as April 30
    const result = fmtDateCell(46143, mockParseFn);
    expect(result).not.toBe("2026-04-30");
    expect(result).toBe("2026-05-01");
  });
});

describe("fmtDateCell() — Date objects (no toISOString timezone shift)", () => {
  it("local midnight Date → correct date (not shifted back)", () => {
    // Simulates XLSX creating new Date(2026, 4, 1) = local midnight IST
    // Old code: .toISOString() → "2026-04-30T18:30:00Z" → WRONG
    // New code: .getFullYear/.getMonth/.getDate → "2026-05-01" → CORRECT
    const d = new Date(2026, 4, 1); // May 1 local midnight
    expect(fmtDateCell(d)).toBe("2026-05-01");
  });

  it("uses getFullYear not getUTCFullYear (local date parts)", () => {
    const d = new Date(2026, 11, 31); // Dec 31 local midnight
    expect(fmtDateCell(d)).toBe("2026-12-31");
  });

  it("handles month padding correctly", () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(fmtDateCell(d)).toBe("2026-01-05");
  });
});

describe("fmtDateCell() — string date formats", () => {
  it("parses ISO format YYYY-MM-DD",       () => expect(fmtDateCell("2026-05-01")).toBe("2026-05-01"));
  it("pads single digit ISO month/day",    () => expect(fmtDateCell("2026-5-1")).toBe("2026-05-01"));
  it("parses MM/DD/YYYY: 05/18/2026 = May 18 (day>12 disambiguates)", () => expect(fmtDateCell("05/18/2026")).toBe("2026-05-18"));
  it("parses DD/MM/YYYY (Indian format)",  () => expect(fmtDateCell("01/05/2026")).toBe("2026-05-01"));
  it("disambiguates when day > 12",        () => expect(fmtDateCell("18/05/2026")).toBe("2026-05-18"));
  it("parses DD-MM-YYYY with dashes",      () => expect(fmtDateCell("01-05-2026")).toBe("2026-05-01"));
  it("handles 2-digit year",               () => expect(fmtDateCell("01/05/26")).toBe("2026-05-01"));
  it("returns '' for unparseable string",  () => expect(fmtDateCell("not-a-date")).toBe(""));
  it("returns '' for random text",         () => expect(fmtDateCell("hello")).toBe(""));
});
