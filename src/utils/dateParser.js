/**
 * Parses an Excel cell value into a "YYYY-MM-DD" string.
 * Accepts: number (serial), Date object, or string.
 *
 * @param {number|Date|string} val - the raw cell value
 * @param {function} [parseFn] - optional fn(serial) => {y,m,d}
 *   In production, pass XLSX.SSF.parse_date_code.
 *   In tests, pass a mock — no XLSX import needed.
 */
export function fmtDateCell(val, parseFn) {
  if (!val && val !== 0) return "";

  // ── Date object (XLSX cellDates:true would produce these) ──────────────────
  if (val instanceof Date) {
    // Use LOCAL date parts — avoids the UTC-midnight toISOString() shift
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // ── Excel serial number (timezone-safe via parseFn arithmetic) ─────────────
  if (typeof val === "number") {
    if (!parseFn) return "";      // can't parse without the SSF function
    try {
      const parsed = parseFn(val);
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }

  // ── String date ────────────────────────────────────────────────────────────
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return "";

    // ISO: YYYY-MM-DD (or YYYY-M-D)
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

    // d/m/y, m/d/y, d-m-y with 2-4 digit year
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmy) {
      const y     = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
      const first  = parseInt(dmy[1]);
      const second = parseInt(dmy[2]);

      if (first > 12) {
        // First part > 12 → must be DD (DD/MM/YYYY)
        return `${y}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
      }
      if (second > 12) {
        // Second part > 12 → must be DD, first = MM (MM/DD/YYYY)
        return `${y}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
      }
      // Both ≤ 12: ambiguous — default DD/MM/YYYY (Indian convention)
      return `${y}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
    }
  }

  return "";
}
