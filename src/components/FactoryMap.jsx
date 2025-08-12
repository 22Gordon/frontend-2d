// FactoryMap.jsx
import React, { useRef } from "react";
import { getEffectiveLayout } from "../utils/layoutStore";
import "../components/FactoryMap.css";

// Deriva estado "active/inactive" a partir dos dados do Orion
function deriveStatus(info, fallback = "inactive") {
  if (!info) return fallback;
  const num = (v) => (v == null ? NaN : Number(v));

  //
  const p = num(info?.TotalPower?.value);            // W
  if (!Number.isNaN(p) && p > 50) return "active";   // >50 W => active

  const i1 = num(info?.Phase1Current?.value);
  const i2 = num(info?.Phase2Current?.value);
  const i3 = num(info?.Phase3Current?.value);
  const anyI = [i1, i2, i3].some((i) => !Number.isNaN(i) && i > 0.5); // >0.5 A
  if (anyI) return "active";

  return fallback;
}

function FactoryMap({
  selectedZone,
  onSelectMachine,
  machineData,
  selectedMachine,
  placementCandidateId,   // colocar nova
  onPlace,                // ({ id, x, y, zone })
  relocateCandidateId,    // mover existente
  onRelocate,             // ({ id, x, y, zone })
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
    const placing = Boolean(placementCandidateId);
    const relocating = Boolean(relocateCandidateId);
    if (!placing && !relocating) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const x = Math.max(0, Math.min(baseW, (relX / rect.width) * baseW));
    const y = Math.max(0, Math.min(baseH, (relY / rect.height) * baseH));

    if (placing) {
      onPlace?.({ id: placementCandidateId, x, y, zone: selectedZone });
    } else if (relocating) {
      onRelocate?.({ id: relocateCandidateId, x, y, zone: selectedZone });
    }
  }

  const placing = Boolean(placementCandidateId);
  const relocating = Boolean(relocateCandidateId);

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
        cursor: placing || relocating ? "crosshair" : "default",
      }}
      onClick={handleMapClick}
      title={
        placing
          ? "Click to place machine"
          : relocating
          ? "Click to move machine"
          : undefined
      }
    >
      {Object.entries(machines).map(([id, data]) => {
        const info = machineData[id];
        // <<< estado agora derivado do Orion (com fallback do layout/overlay)
        const status = deriveStatus(info, data.status || "inactive");
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
              ev.stopPropagation(); // não dispare o place/move
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
        {placing && <span style={{ marginLeft: 10 }}>• Placing: {placementCandidateId}</span>}
        {relocating && <span style={{ marginLeft: 10 }}>• Moving: {relocateCandidateId}</span>}
      </div>
    </div>
  );
}

export default FactoryMap;
