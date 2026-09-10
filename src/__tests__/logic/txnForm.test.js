import { describe, it, expect } from "vitest";
import { parseQuickText } from "../../components/TxnForm";

const MEMBERS = ["NARR", "SHIVU"];

describe("parseQuickText() — 'coffee 89 shivu' auto-fill", () => {
  it("extracts amount + person + description", () => {
    expect(parseQuickText("coffee 89 shivu", MEMBERS)).toEqual({
      amount: 89, person: "SHIVU", desc: "coffee",
    });
  });

  it("matches person case-insensitively, returns canonical casing", () => {
    const r = parseQuickText("COFFEE 89 Shivu", MEMBERS);
    expect(r.person).toBe("SHIVU");
    expect(r.amount).toBe(89);
    expect(r.desc).toBe("COFFEE");
  });

  it("handles decimals", () => {
    expect(parseQuickText("groceries 1250.50 narr", MEMBERS).amount).toBe(1250.5);
  });

  it("keeps multi-word descriptions", () => {
    const r = parseQuickText("big bazaar grocery run 450", MEMBERS);
    expect(r.amount).toBe(450);
    expect(r.person).toBeNull();
    expect(r.desc).toBe("big bazaar grocery run");
  });

  it("unknown words stay in the description", () => {
    const r = parseQuickText("coffee 89 alex", MEMBERS);
    expect(r.amount).toBe(89);
    expect(r.person).toBeNull();
    expect(r.desc).toBe("coffee alex");
  });

  it("only the first number is taken as the amount", () => {
    const r = parseQuickText("room 101 bill 200", MEMBERS);
    expect(r.amount).toBe(101);
    expect(r.desc).toBe("room bill 200");
  });

  it("only the first person match wins", () => {
    const r = parseQuickText("dinner 500 narr shivu", MEMBERS);
    expect(r.person).toBe("NARR");
    expect(r.desc).toBe("dinner shivu");
  });

  it("plain text yields no amount/person", () => {
    expect(parseQuickText("just coffee", MEMBERS)).toEqual({
      amount: null, person: null, desc: "just coffee",
    });
  });

  it("handles empty / whitespace input", () => {
    expect(parseQuickText("", MEMBERS)).toEqual({ amount: null, person: null, desc: "" });
    expect(parseQuickText("   ", MEMBERS)).toEqual({ amount: null, person: null, desc: "" });
  });

  it("handles numbers glued to words (no false amount)", () => {
    // "iPhone16" is one token, not a bare number → stays in description
    const r = parseQuickText("iPhone16", MEMBERS);
    expect(r.amount).toBeNull();
    expect(r.desc).toBe("iPhone16");
  });
});
