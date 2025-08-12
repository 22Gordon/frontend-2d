import React from "react";
import "./ZoneSelector.css";

export default function ZoneSelector({ selectedZone, onChangeZone }) {
  const zones = ["A", "B", "C", "D", "E", "F"];
  return (
    <div className="zone-bar">
      {zones.map((z) => (
        <button
          key={z}
          className={`zone-btn ${selectedZone === z ? "active" : ""}`}
          onClick={() => onChangeZone(z)}
        >
          Zona {z}
        </button>
      ))}
    </div>
  );
}
