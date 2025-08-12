// FactoryMap.jsx
import React, { useRef } from "react";
import { getEffectiveLayout } from "../utils/layoutStore";
import "../components/FactoryMap.css";

function FactoryMap({
  selectedZone,
  onSelectMachine,
  machineData,
  selectedMachine,
  placementCandidateId,   // novo
  onPlace,                // novo ({ id, x, y, zone })
}) {
  // Hooks SEMPRE antes de qualquer return condicional
  const containerRef = useRef(null);

  // usar layout efetivo (json + overlay)
  const layoutData = getEffectiveLayout();
  const zoneData = layoutData[selectedZone];
  if (!zoneData) return <p>Zone not found.</p>;

  const backgroundImage = require(`../assets/${zoneData.image}`);
  const machines = zoneData.machines;

  const baseW = zoneData.baseWidth || 800;
  const baseH = zoneData.baseHeight || 600;

  function handleMapClick(e) {
    if (!placementCandidateId) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    // como o container está fixo a 800x600, mapeia direto
    const x = Math.max(0, Math.min(baseW, (relX / rect.width) * baseW));
    const y = Math.max(0, Math.min(baseH, (relY / rect.height) * baseH));

    onPlace?.({ id: placementCandidateId, x, y, zone: selectedZone });
  }

  return (
    <div
      ref={containerRef}
      className="factory-map"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        width: "800px",
        height: "600px",
        position: "relative",
        border: "1px solid #ccc",
        borderRadius: "10px",
        cursor: placementCandidateId ? "crosshair" : "default",
      }}
      onClick={handleMapClick}
      title={placementCandidateId ? "Click to place machine" : undefined}
    >
      {Object.entries(machines).map(([id, data]) => {
        const info = machineData[id];
        const status = info?.status || data.status || "inactive";
        const isSelected = selectedMachine === id;

        const energy = info?.TotalActiveEnergy?.value;
        const updated = info?.TimeInstant?.value;
        const tooltipText = [
          `ID: ${id}`,
          `Status: ${status}`,
          energy != null
            ? `Energy: ${Number(energy).toLocaleString("en-GB", { maximumFractionDigits: 2 })} Wh`
            : null,
          updated ? `Updated: ${new Date(updated).toLocaleString("en-GB")}` : null,
        ].filter(Boolean).join("\n");

        const topPct = (data.position.y / baseH) * 100;
        const leftPct = (data.position.x / baseW) * 100;

        return (
          <div
            key={id}
            className={`machine ${status === "active" ? "active" : "inactive"} ${isSelected ? "selected" : ""}`}
            title={tooltipText}
            style={{
              top: `${topPct}%`,
              left: `${leftPct}%`,
              width: 30,
              height: 30,
              borderRadius: 20,
              backgroundColor: status === "active" ? "green" : "red",
              color: "#fff",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: isSelected ? "3px solid #00bfff" : "none",
              boxShadow: isSelected ? "0 0 8px #00bfff" : "0 0 4px rgba(0,0,0,0.3)",
              transform: isSelected ? "translate(-50%, -50%) scale(1.1)" : "translate(-50%, -50%) scale(1)",
              position: "absolute",
              zIndex: isSelected ? 2 : 1,
              transition: "all 0.2s ease-in-out",
            }}
            onClick={(ev) => {
              ev.stopPropagation(); // não dispare o place mode
              onSelectMachine(id);
            }}
          >
            {id}
          </div>
        );
      })}

      <div className="map-legend">
        <span><div style={{ width: 12, height: 12, background: "green", borderRadius: "50%" }} /></span> Active
        <span style={{ marginLeft: 10 }}><div style={{ width: 12, height: 12, background: "red", borderRadius: "50%" }} /></span> Inactive
        <span style={{ marginLeft: 10 }}><div style={{ width: 12, height: 12, border: "2px solid #00bfff", borderRadius: "50%" }} /></span> Selected
        {placementCandidateId && <span style={{ marginLeft: 10 }}>• Placing: {placementCandidateId}</span>}
      </div>
    </div>
  );
}

export default FactoryMap;
