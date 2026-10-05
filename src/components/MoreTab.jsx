import { useRef } from "react";
import { T } from "../constants/theme";
import { fmt } from "../utils/format";
import { timeAgo } from "../utils/safety";
import { Btn, Card } from "./ui/primitives";

const ACTION_ICON = {
  txn_add: "➕",
  txn_edit: "✏️",
  txn_delete: "🗑",
  import: "📥",
  restore: "♻️",
  undo: "↩️",
  plan_add: "📝",
  plan_edit: "✏️",
  plan_delete: "🗑",
  card_add: "💳",
  card_edit: "✏️",
  card_delete: "🗑",
  clear: "🧹",
};

export function MoreTab({ s, isMobile, onExportCSV, onExportJSON, onRestoreFile, onClearAll }) {
  const fileRef = useRef(null);
  const activity = s.activity || [];
  const txnCount = (s.transactions || []).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          💾 Data &amp; Backup
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
          {txnCount} transaction{txnCount === 1 ? "" : "s"} · {fmt((s.transactions || []).reduce((a, t) => a + (t.amount || 0), 0))} tracked all-time
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <Btn variant="outline" color={T.accent} onClick={onExportCSV} full>
            ⬇ Transactions CSV
          </Btn>
          <Btn variant="outline" color={T.purple} onClick={onExportJSON} full>
            ⬇ Full Backup (JSON)
          </Btn>
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, lineHeight: 1.5 }}>
            Restoring replaces <b style={{ color: T.text }}>all shared family data</b> with
            the backup file. You can undo it right after.
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              onRestoreFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Btn variant="outline" color={T.amber} onClick={() => fileRef.current?.click()} full>
            ♻️ Restore from Backup…
          </Btn>
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          🧹 Fresh Start
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, lineHeight: 1.5 }}>
          Removes <b style={{ color: T.text }}>everything entered so far</b> — transactions,
          plan changes, credit cards and the activity log — and resets the app to its
          starter template. You can undo right after, and a backup above is a good idea first.
        </div>
        <Btn variant="outline" color={T.rose} onClick={onClearAll} full>
          🗑 Clear All Data…
        </Btn>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          🕘 Recent Activity
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
          Who changed what, across both family members
        </div>
        {activity.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: T.muted, fontSize: 13 }}>
            No activity yet — adds, edits, deletes and imports will show up here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {activity.slice(0, 50).map((e) => (
              <div
                key={e.id || `${e.ts}-${e.detail}`}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "9px 0",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1.4 }}>{ACTION_ICON[e.action] || "•"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{e.detail || e.action}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {e.actor || "Someone"} · {timeAgo(e.ts || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
