import React from "react";

function ZoneSelector({ selectedZone, onChangeZone }) {
  const zones = ["A", "B", "C", "D", "E", "F"];

  return (
    <div style={{ marginBottom: 20 }}>
      {zones.map((zone) => (
        <button
          key={zone}
          onClick={() => onChangeZone(zone)}
          style={{
            marginRight: 10,
            padding: "8px 12px",
            backgroundColor: selectedZone === zone ? "#007bff" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Zona {zone}
        </button>
      ))}
    </div>
  );
}

export default ZoneSelector;
