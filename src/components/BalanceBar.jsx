import { useState } from "react";
import { T } from "../constants/theme";
import { fmt } from "../utils/format";

/**
 * Always-visible running bank balance bar shown above every tab.
 * - runningBalance: all-time income − outflows + startingBalance
 * - monthNet: this month's net (income − outflows for selected month only)
 * - totalCCOwed: outstanding CC bills still to pay
 * - safeBalance: runningBalance − totalCCOwed
 * - onSetStarting: callback when user edits the starting balance
 */
export function BalanceBar({ runningBalance, monthNet, totalCCOwed, startingBalance, onSetStarting, isMobile }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const safeBalance = runningBalance - totalCCOwed;
  const safeClr = safeBalance >= 0 ? T.green : T.rose;
  const balClr  = runningBalance >= 0 ? T.accent : T.rose;

  const save = () => {
    const val = parseFloat(draft);
    if (!isNaN(val)) onSetStarting(val);
    setEditing(false);
    setDraft("");
  };

  return (
    <div style={{
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      padding: isMobile ? "10px 14px" : "10px 24px",
    }}>
      <div style={{
        maxWidth: 1280,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 10 : 24,
        flexWrap: isMobile ? "wrap" : "nowrap",
      }}>

        {/* Running bank balance */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          title="Tap to set starting balance"
          onClick={() => { if (!editing) { setDraft(String(startingBalance || 0)); setEditing(true); } }}
        >
          <span style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>🏦 Bank Balance</span>
          {editing ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                autoFocus
                type="number"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                placeholder="Starting balance"
                style={{
                  width: 120,
                  background: T.card,
                  border: `1px solid ${T.accent}`,
                  borderRadius: 6,
                  color: T.text,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "4px 8px",
                  outline: "none",
                }}
              />
              <button onClick={save} style={{ background: T.accent, border: "none", color: T.bg, borderRadius: 6, padding: "4px 10px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Set</button>
              <button onClick={() => setEditing(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 6, padding: "4px 8px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: balClr }}>{fmt(runningBalance)}</span>
              {startingBalance === 0 && (
                <span style={{ fontSize: 10, color: T.amber, fontWeight: 600, marginLeft: 4 }}>
                  ✏️ Set starting balance
                </span>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        {!isMobile && <div style={{ width: 1, height: 24, background: T.border }} />}

        {/* Safe balance (after CC bills) */}
        {totalCCOwed > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>💳 After CC Bills</span>
            <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: safeClr }}>{fmt(safeBalance)}</span>
          </div>
        )}

        {/* This month net */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <span style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>📅 This month</span>
          <span style={{
            fontSize: isMobile ? 13 : 14,
            fontWeight: 700,
            color: monthNet >= 0 ? T.green : T.rose,
            background: (monthNet >= 0 ? T.green : T.rose) + "18",
            borderRadius: 999,
            padding: "3px 10px",
          }}>
            {monthNet >= 0 ? "+" : ""}{fmt(monthNet)}
          </span>
        </div>

      </div>

      {/* First-time hint */}
      {startingBalance === 0 && !editing && (
        <div style={{ fontSize: 11, color: T.amber, marginTop: 6, maxWidth: 1280, margin: "6px auto 0" }}>
          ☝️ Tap "Bank Balance" to enter your actual balance once — the app tracks everything from there automatically.
        </div>
      )}
    </div>
  );
}
