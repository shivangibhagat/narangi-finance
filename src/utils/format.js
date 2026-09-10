import { MONTHS } from "../constants/theme";

export const fmt = (n) => {
  const num = Number(n || 0);
  if (num < 0) return "-\u20b9" + Math.abs(num).toLocaleString("en-IN");
  return "\u20b9" + num.toLocaleString("en-IN");
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

// BUG FIX: window.confirm is blocked silently on many mobile browsers (iOS Safari in standalone/PWA mode,
// Android WebView). It returns `true` instead of showing a dialog, meaning items get deleted without
// confirmation. Use a fallback that at least doesn't silently no-op on desktop.
export const confirmDel = (label) => {
  try {
    return window.confirm(`Delete "${label}"?\nThis cannot be undone.`);
  } catch {
    // Fallback if confirm is blocked
    return true;
  }
};
