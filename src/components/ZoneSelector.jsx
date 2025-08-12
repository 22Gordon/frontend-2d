import React from "react";
import "../styles/ui.css";

export default function ZoneSelector({ selectedZone, onChangeZone }) {
  const zones = ["A","B","C","D","E","F"];
  return (
    <div className="chipbar">
      {zones.map(z => (
        <button
          key={z}
          className={`chip ${selectedZone === z ? "is-active" : ""}`}
          onClick={() => onChangeZone(z)}
        >
          Zona {z}
        </button>
      ))}
    </div>
  );
}
