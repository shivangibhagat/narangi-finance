import { useIsMobile } from "../../hooks/useIsMobile";
import { T } from "../../constants/theme";
import { fmt } from "../../utils/format";

export const Card = ({ children, style = {} }) => (
  <div
    style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: "16px 18px",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Btn = ({
  children,
  onClick,
  color = T.accent,
  variant = "solid",
  small,
  full,
  style = {},
}) => (
  <button
    onClick={onClick}
    style={{
      background: variant === "solid" ? color : "transparent",
      color: variant === "solid" ? T.bg : color,
      border: `1px solid ${color}`,
      borderRadius: 10,
      padding: small ? "8px 14px" : "11px 20px",
      fontSize: small ? 12 : 14,
      fontWeight: 700,
      cursor: "pointer",
      width: full ? "100%" : "auto",
      WebkitTapHighlightColor: "transparent",
      ...style,
    }}
  >
    {children}
  </button>
);

export const Badge = ({ color, children, small }) => (
  <span
    style={{
      background: color + "22",
      color,
      border: `1px solid ${color}44`,
      borderRadius: 999,
      padding: small ? "1px 8px" : "3px 10px",
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

export const Lbl = ({ children }) => (
  <label
    style={{
      color: T.muted,
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      display: "block",
      marginBottom: 6,
    }}
  >
    {children}
  </label>
);

export const iSty = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  color: T.text,
  borderRadius: 10,
  padding: "11px 14px",
  fontSize: 15,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  WebkitAppearance: "none",
};

export const TI = ({ label, value, onChange, type = "text", placeholder = "", style = {}, min }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <Lbl>{label}</Lbl>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      style={{ ...iSty, ...style }}
    />
  </div>
);

export const Sel = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <Lbl>{label}</Lbl>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...iSty, appearance: "none" }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

export const ActualBar = ({ budget, actual, color }) => {
  if (!budget || budget <= 0)
    return (
      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
        Actual: {fmt(actual)}
      </div>
    );
  const pct = Math.min(100, Math.round((actual / budget) * 100));
  const c = pct >= 100 ? T.rose : pct >= 80 ? T.amber : T.green;
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          marginBottom: 3,
        }}
      >
        <span style={{ color: T.muted }}>
          Actual:{" "}
          <span style={{ color: c, fontWeight: 700 }}>{fmt(actual)}</span>
        </span>
        <span style={{ color: c, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: T.border, borderRadius: 99 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: c,
            borderRadius: 99,
            transition: "width 0.4s",
          }}
        />
      </div>
    </div>
  );
};

export const Modal = ({ open, onClose, title, children }) => {
  const isMobile = useIsMobile();
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000099",
        zIndex: 1000,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: isMobile ? "20px 20px 0 0" : "20px",
          padding: isMobile ? "0 20px 24px" : "24px 20px",
          paddingTop: isMobile ? 0 : 24,
          width: isMobile ? "100%" : "500px",
          maxWidth: "100%",
          maxHeight: isMobile ? "92dvh" : "90vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && (
          <div style={{ padding: "16px 0 0", position: "sticky", top: 0, background: T.card, zIndex: 1 }}>
            <div
              style={{
                width: 40,
                height: 4,
                background: T.border,
                borderRadius: 99,
                margin: "0 auto 16px",
              }}
            />
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: T.muted,
              fontSize: 26,
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const PulseStyles = () => (
  <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
);

export const LoadingScreen = ({ message = "Loading…" }) => (
  <div
    style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.muted }}>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: T.accent,
          animation: "pulse 1s infinite",
        }}
      />
      <PulseStyles />
      <span style={{ fontSize: 14 }}>{message}</span>
    </div>
  </div>
);

export const ConnectingScreen = () => (
  <div
    style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        background: `linear-gradient(135deg,${T.accent},${T.purple})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
      }}
    >
      🪙
    </div>
    <div style={{ color: T.text, fontWeight: 700, fontSize: 18 }}>Narangi Finance</div>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: T.accent,
          animation: "pulse 1s infinite",
        }}
      />
      <span style={{ color: T.muted, fontSize: 13 }}>Connecting to database…</span>
    </div>
    <PulseStyles />
  </div>
);
