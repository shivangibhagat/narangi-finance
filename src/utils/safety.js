// Safety-pack utilities: undo history, activity log, backup/export.
// Everything here is pure and unit-tested, except downloadFile (browser-only).
import { uid } from "./format";

// ─── Undo history ────────────────────────────────────────────────────────────
export const HISTORY_CAP = 10;

// Deep-clone a state snapshot so later mutations can't corrupt the history.
export const snapshotState = (s) =>
  typeof structuredClone === "function"
    ? structuredClone(s)
    : JSON.parse(JSON.stringify(s));

// Push a snapshot, keeping only the newest `cap` entries. Returns a new array.
export const pushHistory = (stack, snap, cap = HISTORY_CAP) =>
  [...(stack || []), snap].slice(-cap);

// ─── Activity log ────────────────────────────────────────────────────────────
export const ACTIVITY_CAP = 100;

export const actorFromUser = (user) => {
  const name = (user?.email || "").split("@")[0].trim();
  return name || "Someone";
};

export const makeActivityEntry = ({ actor = "Someone", action = "", detail = "", ts = Date.now() } = {}) => ({
  id: uid(),
  ts,
  actor,
  action,
  detail,
});

// Newest-first, capped. Tolerates a missing/corrupt log.
export const appendActivity = (log, entry, cap = ACTIVITY_CAP) =>
  [entry, ...(Array.isArray(log) ? log : [])].slice(0, cap);

// Merge activity trails on undo: data comes from the snapshot, but log entries
// created after the snapshot was taken (e.g. the delete being undone) are
// preserved, so the shared log stays a truthful append-only trail.
export const mergeUndoActivity = (currentLog, snapLog, undoEntry, snapTs = 0) => {
  const fresh = (Array.isArray(currentLog) ? currentLog : []).filter(
    (e) => (e?.ts ?? 0) >= snapTs
  );
  const seen = new Set(fresh.map((e) => e?.id));
  const base = (Array.isArray(snapLog) ? snapLog : []).filter((e) => !seen.has(e?.id));
  return [undoEntry, ...fresh, ...base].slice(0, ACTIVITY_CAP);
};

export const timeAgo = (ts, now = Date.now()) => {
  const mins = Math.floor(Math.max(0, now - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

// ─── CSV export ──────────────────────────────────────────────────────────────
const csvCell = (v) => {
  const str = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// All transactions, oldest first, with RFC-4180 escaping.
export const transactionsToCSV = (txns) => {
  const rows = [...(txns || [])].sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || ""))
  );
  const lines = ["Date,Description,Amount,Category,Sub Category,Person,Tags,Note"];
  for (const t of rows) {
    lines.push(
      [
        t.date || "",
        t.spentOn || "",
        t.amount ?? "",
        t.category || "",
        t.subCat || "",
        t.person || "",
        (t.tags || []).join("; "),
        t.note || "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
};

// ─── JSON backup / restore ───────────────────────────────────────────────────
export const BACKUP_VERSION = 1;

export const buildBackup = (state, actor) => ({
  app: "narangi-finance",
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  exportedBy: actor || "Someone",
  counts: { transactions: (state?.transactions || []).length },
  // Deep copy so the backup can't be mutated via the live state.
  data: JSON.parse(JSON.stringify(state ?? {})),
});

// Accepts full backups ({app, data}) as well as raw state dumps ({transactions...}).
export const parseBackup = (text) => {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not a valid JSON file." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return { ok: false, error: "Backup file has an unexpected format." };
  const data =
    parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
      ? parsed.data
      : parsed;
  if (!Array.isArray(data.transactions))
    return { ok: false, error: "No transactions found in this file." };
  return {
    ok: true,
    data,
    exportedAt: parsed.exportedAt || null,
    txnCount: data.transactions.length,
  };
};

export const todayStamp = () => new Date().toISOString().slice(0, 10);

// Triggers a browser download. Returns false (instead of throwing) when the
// environment can't download (SSR/tests/old browsers).
export const downloadFile = (filename, content, mime = "text/plain") => {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  try {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
};
