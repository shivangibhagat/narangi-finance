import { describe, it, expect } from "vitest";
import {
  snapshotState,
  pushHistory,
  HISTORY_CAP,
  actorFromUser,
  makeActivityEntry,
  appendActivity,
  ACTIVITY_CAP,
  timeAgo,
  transactionsToCSV,
  buildBackup,
  parseBackup,
  todayStamp,
  downloadFile,
  mergeUndoActivity,
} from "../../utils/safety";

describe("snapshotState", () => {
  it("deep-clones so later mutations can't corrupt history", () => {
    const s = { transactions: [{ id: "1", amount: 100 }], nested: { a: [1] } };
    const snap = snapshotState(s);
    expect(snap).toEqual(s);
    s.transactions[0].amount = 999;
    s.nested.a.push(2);
    expect(snap.transactions[0].amount).toBe(100);
    expect(snap.nested.a).toEqual([1]);
  });
});

describe("pushHistory", () => {
  it("appends and returns a new array (no mutation)", () => {
    const stack = [{ a: 1 }];
    const out = pushHistory(stack, { a: 2 });
    expect(out).toEqual([{ a: 1 }, { a: 2 }]);
    expect(stack).toEqual([{ a: 1 }]);
  });
  it("caps the stack, keeping the newest snapshots", () => {
    let stack = [];
    for (let i = 0; i < HISTORY_CAP + 5; i++) stack = pushHistory(stack, { i });
    expect(stack).toHaveLength(HISTORY_CAP);
    expect(stack[0]).toEqual({ i: 5 });
    expect(stack[stack.length - 1]).toEqual({ i: HISTORY_CAP + 4 });
  });
  it("tolerates a null stack", () => {
    expect(pushHistory(null, { a: 1 })).toEqual([{ a: 1 }]);
  });
});

describe("actorFromUser", () => {
  it("uses the email prefix", () => expect(actorFromUser({ email: "narr@gmail.com" })).toBe("narr"));
  it("falls back to Someone when user/email is missing", () => {
    expect(actorFromUser(null)).toBe("Someone");
    expect(actorFromUser({})).toBe("Someone");
    expect(actorFromUser({ email: "" })).toBe("Someone");
  });
});

describe("activity log", () => {
  it("makeActivityEntry fills id/ts defaults", () => {
    const before = Date.now();
    const e = makeActivityEntry({ actor: "narr", action: "txn_add", detail: "Added x" });
    expect(typeof e.id).toBe("string");
    expect(e.id.length).toBeGreaterThan(0);
    expect(e.ts).toBeGreaterThanOrEqual(before);
    expect(e.actor).toBe("narr");
    expect(e.action).toBe("txn_add");
    expect(e.detail).toBe("Added x");
  });
  it("appendActivity prepends (newest first)", () => {
    const a = makeActivityEntry({ detail: "first" });
    const b = makeActivityEntry({ detail: "second" });
    expect(appendActivity([a], b).map((e) => e.detail)).toEqual(["second", "first"]);
  });
  it("appendActivity caps at 100, keeping the newest", () => {
    let log = [];
    for (let i = 0; i < ACTIVITY_CAP + 20; i++)
      log = appendActivity(log, makeActivityEntry({ detail: `e${i}` }));
    expect(log).toHaveLength(ACTIVITY_CAP);
    expect(log[0].detail).toBe(`e${ACTIVITY_CAP + 19}`);
  });
  it("appendActivity tolerates a corrupt log", () => {
    const e = makeActivityEntry({ detail: "x" });
    expect(appendActivity(null, e)).toEqual([e]);
    expect(appendActivity("garbage", e)).toEqual([e]);
  });
});

describe("mergeUndoActivity", () => {
  it("keeps post-snapshot entries (e.g. the delete) on top of the snapshot trail", () => {
    const added = makeActivityEntry({ detail: "Added x", ts: 1000 });
    const deleted = makeActivityEntry({ detail: "Deleted x", ts: 2000 });
    const undo = makeActivityEntry({ detail: "Undid the last change", ts: 3000 });
    const out = mergeUndoActivity([deleted, added], [added], undo, 1500);
    expect(out.map((e) => e.detail)).toEqual([
      "Undid the last change",
      "Deleted x",
      "Added x",
    ]);
  });
  it("drops pre-snapshot entries that the current log already moved past", () => {
    // Restore case: current log is the backup's own trail — only entries newer
    // than the snapshot (the restore entry) are carried over, no duplication.
    const old = makeActivityEntry({ detail: "old", ts: 100 });
    const backupOld = makeActivityEntry({ detail: "backup-old", ts: 200 });
    const restored = makeActivityEntry({ detail: "Restored backup", ts: 2000 });
    const undo = makeActivityEntry({ detail: "Undid the last change", ts: 3000 });
    const out = mergeUndoActivity([restored, backupOld], [old], undo, 1500);
    expect(out.map((e) => e.detail)).toEqual([
      "Undid the last change",
      "Restored backup",
      "old",
    ]);
  });
  it("tolerates corrupt logs", () => {
    const undo = makeActivityEntry({ detail: "u" });
    expect(mergeUndoActivity(null, null, undo, 0)).toEqual([undo]);
    expect(mergeUndoActivity("x", 5, undo, 0)).toEqual([undo]);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-09-10T12:00:00Z").getTime();
  it("says 'just now' under a minute (and for future timestamps)", () => {
    expect(timeAgo(now, now)).toBe("just now");
    expect(timeAgo(now - 30 * 1000, now)).toBe("just now");
    expect(timeAgo(now + 60000, now)).toBe("just now");
  });
  it("formats minutes / hours / days", () => {
    expect(timeAgo(now - 5 * 60000, now)).toBe("5m ago");
    expect(timeAgo(now - 3 * 3600000, now)).toBe("3h ago");
    expect(timeAgo(now - 2 * 86400000, now)).toBe("2d ago");
  });
  it("falls back to a date after a week", () => {
    const ts = now - 10 * 86400000;
    expect(timeAgo(ts, now)).toBe(
      new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    );
  });
});

describe("transactionsToCSV", () => {
  it("emits a header even for empty input", () => {
    const out = transactionsToCSV([]);
    expect(out.split("\n")[0]).toBe("Date,Description,Amount,Category,Sub Category,Person,Tags,Note");
    expect(transactionsToCSV(null)).toBe(out);
  });
  it("serializes rows oldest-first with tags joined", () => {
    const out = transactionsToCSV([
      { date: "2026-06-01", spentOn: "B", amount: 200, category: "INCOME", subCat: "S", person: "NARR", tags: ["x", "y"], note: "" },
      { date: "2026-05-01", spentOn: "A", amount: 100, category: "FIXED EXPENSES", subCat: "R", person: "SHIVU", tags: [], note: "n" },
    ]);
    const lines = out.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("2026-05-01,A,100,FIXED EXPENSES,R,SHIVU,,n");
    expect(lines[2]).toBe("2026-06-01,B,200,INCOME,S,NARR,x; y,");
  });
  it("escapes commas, quotes and newlines (RFC-4180)", () => {
    const out = transactionsToCSV([
      { date: "2026-05-01", spentOn: 'Cafe "Sun, Moon"', amount: 50, note: "line1\nline2" },
    ]);
    expect(out).toContain('"Cafe ""Sun, Moon"""');
    expect(out).toContain('"line1\nline2"');
  });
  it("tolerates missing fields", () => {
    expect(() => transactionsToCSV([{}])).not.toThrow();
    expect(transactionsToCSV([{}]).trim().split("\n")).toHaveLength(2);
  });
});

describe("buildBackup / parseBackup", () => {
  const state = { members: ["NARR"], transactions: [{ id: "1", amount: 5 }], activity: [] };
  it("buildBackup wraps state with metadata and a deep copy", () => {
    const b = buildBackup(state, "narr");
    expect(b.app).toBe("narangi-finance");
    expect(b.version).toBe(1);
    expect(b.exportedBy).toBe("narr");
    expect(b.counts).toEqual({ transactions: 1 });
    expect(new Date(b.exportedAt).getTime()).not.toBeNaN();
    b.data.transactions[0].amount = 999;
    expect(state.transactions[0].amount).toBe(5);
  });
  it("round-trips through JSON", () => {
    const parsed = parseBackup(JSON.stringify(buildBackup(state, "narr")));
    expect(parsed.ok).toBe(true);
    expect(parsed.txnCount).toBe(1);
    expect(parsed.data.transactions).toEqual([{ id: "1", amount: 5 }]);
    expect(typeof parsed.exportedAt).toBe("string");
  });
  it("accepts a raw state dump (no wrapper)", () => {
    const parsed = parseBackup(JSON.stringify(state));
    expect(parsed.ok).toBe(true);
    expect(parsed.txnCount).toBe(1);
  });
  it("rejects invalid JSON", () => {
    const r = parseBackup("{nope");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/valid JSON/);
  });
  it("rejects non-objects and files without transactions", () => {
    expect(parseBackup("[1,2]").ok).toBe(false);
    expect(parseBackup('"str"').ok).toBe(false);
    expect(parseBackup("{}").ok).toBe(false);
    expect(parseBackup('{"data":{}}').ok).toBe(false);
    expect(parseBackup('{"transactions":"nope"}').ok).toBe(false);
    expect(parseBackup("{}").error).toMatch(/No transactions/);
  });
});

describe("todayStamp / downloadFile", () => {
  it("todayStamp is YYYY-MM-DD", () => {
    expect(todayStamp()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("downloadFile fails gracefully when the environment can't download", () => {
    // jsdom has no URL.createObjectURL — must return false, not throw.
    expect(downloadFile("x.csv", "a,b", "text/csv")).toBe(false);
  });
});
