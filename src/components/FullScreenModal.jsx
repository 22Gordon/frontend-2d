import React, { useEffect } from "react";

export default function FullScreenModal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKey);

    // lock scroll no body
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(2, 6, 23, 0.45)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
        padding: 18,
      }}
      onMouseDown={(e) => {
        // fecha só se clicares no fundo (fora do conteúdo)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}
