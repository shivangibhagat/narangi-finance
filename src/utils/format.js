import { MONTHS } from "../constants/theme";

export const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const mNum = (m) => String(MONTHS.indexOf(m) + 1).padStart(2, "0");
export const monthKey = (y, m) => `${y}-${mNum(m)}`;
export const ccKey = (ccId, y, m) => `${ccId}_${y}-${mNum(m)}`;
export const confirmDel = (label) =>
  window.confirm(`Delete "${label}"?\nThis cannot be undone.`);
