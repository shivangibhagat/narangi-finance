import { useEffect, useMemo, useRef } from "react";
import { T, CATS, CAT_CLR, CAT_ICON } from "../constants/theme";
import { DEFAULTS } from "../constants/defaults";
import { Btn, Lbl, Sel, TI, iSty } from "./ui/primitives";

// ─── Quick-parse natural language: "coffee 89 shivu" ─────────────────────────
function parseQuickText(text, members, subCats) {
  const parts = text.trim().split(/\s+/);
  let amount = null;
  let person = null;
  const descWords = [];

  for (const p of parts) {
    if (amount === null && /^\d+(\.\d+)?$/.test(p)) {
      amount = parseFloat(p);
    } else if (person === null && members.find(m => m.toLowerCase() === p.toLowerCase())) {
      person = members.find(m => m.toLowerCase() === p.toLowerCase());
    } else {
      descWords.push(p);
    }
  }
  return { amount, person, desc: descWords.join(" ") };
}

// ─── Transaction Form ──────────────────────────────────────────────────────────
export function TxnForm({ state, value, onChange, onSubmit, submitLabel = "Add Transaction" }) {
  const members = state.members || DEFAULTS.members;
  const amountRef = useRef(null);

  // subCatValues: canonical stored value (subCat || label)
  // subCatLabels: human-readable display label
  const subCatValues = useMemo(() => ({
    INCOME:             (state.income       || []).map(i => i.subCat || i.label),
    "FIXED EXPENSES":   (state.fixedExpenses|| []).map(f => f.subCat || f.label),
    "VARIABLE EXPENSES": state.variableSubCats || [],
    SAVINGS:            (state.savings      || []).map(s => s.label),
    "CC PAYMENT":       (state.creditCards  || []).map(c => c.name),
  }), [state.income, state.fixedExpenses, state.variableSubCats, state.savings, state.creditCards]);
  const subCatLabels = useMemo(() => ({
    INCOME:             (state.income       || []).map(i => i.label),
    "FIXED EXPENSES":   (state.fixedExpenses|| []).map(f => f.label),
    "VARIABLE EXPENSES": state.variableSubCats || [],
    SAVINGS:            (state.savings      || []).map(s => s.label),
    "CC PAYMENT":       (state.creditCards  || []).map(c => c.name),
  }), [state.income, state.fixedExpenses, state.variableSubCats, state.savings, state.creditCards]);
  // For backward compat in effect deps and subCat checks
  const subCatMap = subCatValues;

  const subCats = subCatValues[value.category] || [];   // canonical values
  const subCatDisplays = subCatLabels[value.category] || []; // display labels

  // Reset subCat when category changes and current subCat is no longer valid
  useEffect(() => {
    if (subCats.length > 0 && !subCats.includes(value.subCat)) {
      const cc = value.category === "CC PAYMENT" ? state.creditCards.find(c => c.name === subCats[0]) : null;
      onChange({ ...value, subCat: subCats[0], ccId: cc?.id ?? null });
    }
  }, [subCats.join("|"), value.category, value.subCat]);

  // BUG FIX: T was not imported in original TxnForm — tags buttons were broken
  const upd = patch => onChange({ ...value, ...patch });

  // Quick-parse handler
  const handleQuickParse = (text) => {
    const { amount, person, desc } = parseQuickText(text, members, subCats);
    const patch = { spentOn: desc || text };
    if (amount !== null) patch.amount = String(amount);
    if (person !== null) patch.person = person;
    onChange({ ...value, ...patch });
  };

  const isValid = value.spentOn?.trim() && parseFloat(value.amount) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Person toggle — big tap-friendly buttons instead of a select on mobile */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Lbl>Who paid?</Lbl>
        <div style={{ display: "flex", gap: 8 }}>
          {members.map((m, i) => {
            const clr = i === 0 ? T.accent : T.purple;
            const active = value.person === m;
            return (
              <button
                key={m}
                onClick={() => upd({ person: m })}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `2px solid ${active ? clr : T.border}`,
                  background: active ? clr + "22" : "transparent",
                  color: active ? clr : T.muted,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  transition: "all 0.15s",
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category — color-coded pill buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Lbl>Category</Lbl>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATS.map(cat => {
            const clr = CAT_CLR[cat] || T.muted;
            const active = value.category === cat;
            const subs = subCatMap[cat] || [];
            return (
              <button
                key={cat}
                onClick={() => {
                  const cc = cat === "CC PAYMENT" ? (state.creditCards || [])[0] : null;
                  upd({ category: cat, subCat: subs[0] || "", ccId: cc?.id ?? null });
                }}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: `1px solid ${active ? clr : T.border}`,
                  background: active ? clr + "22" : "transparent",
                  color: active ? clr : T.muted,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>{CAT_ICON[cat]}</span>
                <span>{cat.replace(" EXPENSES", "").replace("CC PAYMENT", "CC")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-category — horizontal scroll chips */}
      {subCats.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Lbl>Sub-Category</Lbl>
          <div style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: 4,
          }}>
            {subCats.map((sc, sciIdx) => {
              const displayLabel = subCatDisplays[sciIdx] || sc;
              const active = (subCats.includes(value.subCat) ? value.subCat : subCats[0]) === sc;
              return (
                <button
                  key={sc}
                  onClick={() => {
                    const cc = value.category === "CC PAYMENT" ? (state.creditCards || []).find(c => c.name === sc) : null;
                    upd({ subCat: sc, ccId: cc?.id ?? null });
                  }}
                  style={{
                    flexShrink: 0,
                    padding: "7px 14px",
                    borderRadius: 999,
                    border: `1px solid ${active ? T.accent : T.border}`,
                    background: active ? T.accent + "22" : "transparent",
                    color: active ? T.accent : T.muted,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Description with quick-parse hint */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Lbl>Description <span style={{ color: T.muted, fontWeight: 400, textTransform: "none" }}>— or type "coffee 89 shivu" to auto-fill</span></Lbl>
        <input
          type="text"
          value={value.spentOn}
          onChange={e => {
            const txt = e.target.value;
            // If text matches quick-parse pattern (has a number), parse it
            if (/\d/.test(txt) && txt.split(" ").some(p => /^\d+$/.test(p))) {
              handleQuickParse(txt);
            } else {
              upd({ spentOn: txt });
            }
          }}
          placeholder="What was this for?"
          style={{ ...iSty }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
        />
      </div>

      {/* Amount — large, numeric keyboard on mobile */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Lbl>Amount (₹)</Lbl>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 16,
            fontWeight: 700,
            color: T.muted,
            pointerEvents: "none",
          }}>₹</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            value={String(value.amount || "")}
            onChange={e => upd({ amount: e.target.value })}
            placeholder="0"
            style={{
              ...iSty,
              paddingLeft: 30,
              fontSize: 22,
              fontWeight: 800,
              color: T.text,
              letterSpacing: "0.01em",
            }}
          />
        </div>
      </div>

      {/* Date */}
      <TI label="Date" type="date" value={value.date} onChange={v => upd({ date: v })} min="2026-05-01" />

      {/* Note */}
      <TI label="Note (optional)" value={value.note || ""} onChange={v => upd({ note: v })} placeholder="Any details..." />

      {/* Paid by CC toggle — only for expense categories when CC cards exist */}
      {["FIXED EXPENSES", "VARIABLE EXPENSES"].includes(value.category) && (state.creditCards || []).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Lbl>Payment Method</Lbl>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "💳 Credit Card", val: true  },
              { label: "💵 Cash / UPI",  val: false },
            ].map(opt => {
              const active = !!value.paidByCC === opt.val;
              return (
                <button
                  key={String(opt.val)}
                  onClick={() => upd({ paidByCC: opt.val })}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 10,
                    border: `2px solid ${active ? T.accent : T.border}`,
                    background: active ? T.accent + "22" : "transparent",
                    color: active ? T.accent : T.muted,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {value.paidByCC && (
            <div style={{ fontSize: 11, color: T.muted, padding: "6px 10px", background: T.surface, borderRadius: 8 }}>
              💡 Won't reduce bank balance — covered when you pay your CC bill
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {(state.customTags || []).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Lbl>Tags</Lbl>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(state.customTags || []).map(tag => {
              const active = (value.tags || []).includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => upd({ tags: active ? (value.tags || []).filter(t => t !== tag) : [...(value.tags || []), tag] })}
                  style={{
                    background: active ? T.accent + "33" : "transparent",
                    color: active ? T.accent : T.muted,
                    border: `1px solid ${active ? T.accent : T.border}`,
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Btn
        full
        onClick={onSubmit}
        style={{
          marginTop: 4,
          padding: "16px",
          fontSize: 15,
          opacity: isValid ? 1 : 0.5,
          cursor: isValid ? "pointer" : "default",
        }}
      >
        {submitLabel}
      </Btn>
    </div>
  );
}
