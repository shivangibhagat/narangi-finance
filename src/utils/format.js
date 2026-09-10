import { MONTHS } from "../constants/theme";

export const fmt = (n) => {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return "₹0";
  if (num < 0) return "-₹" + Math.abs(num).toLocaleString("en-IN");
  return "₹" + num.toLocaleString("en-IN");
};
// Collision-safe IDs: bulk Excel imports create 100+ txns within the same millisecond,
// so Date.now() alone is not enough entropy. Prefer crypto.randomUUID when available.
export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
export const mNum = (m) => String(MONTHS.indexOf(m) + 1).padStart(2, "0");
export const monthKey = (y, m) => `${y}-${mNum(m)}`;
export const ccKey = (ccId, y, m) => `${ccId}_${y}-${mNum(m)}`;
