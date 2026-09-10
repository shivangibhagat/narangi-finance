import { T } from "../constants/theme";

// Bottom toast for destructive actions. `toast`: { msg, canUndo } | null.
// pointerEvents:none on the wrapper so it never blocks taps outside the pill.
export function UndoToast({ toast, onUndo, onDismiss, isMobile }) {
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: isMobile ? 148 : 32,
        display: "flex",
        justifyContent: "center",
        zIndex: 1200,
        padding: "0 16px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: "10px 10px 10px 16px",
          boxShadow: "0 8px 32px #00000088",
          maxWidth: 480,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{toast.msg}</span>
        {toast.canUndo && (
          <button
            onClick={onUndo}
            style={{
              background: T.accent,
              border: "none",
              color: T.bg,
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Undo
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: T.muted,
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px 6px",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
