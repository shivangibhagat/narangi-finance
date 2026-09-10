import { useEffect } from "react";
import { T } from "../constants/theme";
import { Btn, Modal } from "./ui/primitives";

// In-app replacement for window.confirm (which never renders in iOS PWA mode —
// deletes there happened with zero confirmation). Rendered once at App root and
// driven by `confirmState`: { title, message, confirmLabel, tone, onConfirm }.
export function ConfirmDialog({ confirmState, onConfirm, onCancel }) {
  const open = !!confirmState;
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;

  const { title, message, confirmLabel = "Delete", tone = "danger" } = confirmState;
  const color = tone === "danger" ? T.rose : T.accent;
  return (
    <Modal open onClose={onCancel} title={title}>
      {message && (
        <div style={{ fontSize: 14, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>
          {message}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Btn variant="outline" color={T.muted} onClick={onCancel} full>
          Cancel
        </Btn>
        <Btn color={color} onClick={onConfirm} full>
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}
