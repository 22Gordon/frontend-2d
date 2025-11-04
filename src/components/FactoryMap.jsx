// FactoryMap.jsx
import React, { useRef } from "react";
import {
  getEffectiveLayout,
  removeZone,
  isRemovableZone,
  listZones
} from "../utils/layoutStore";
import "./FactoryMap.css";
import { Cog } from "lucide-react";

// Deriva estado "active/inactive" a partir dos dados do Orion
function deriveStatus(info, fallback = "inactive") {
  if (!info) return fallback;
  const num = (v) => (v == null ? NaN : Number(v));

  const p = num(info?.TotalPower?.value);
  if (!Number.isNaN(p) && p > 50) return "active";

  const i1 = num(info?.Phase1Current?.value);
  const i2 = num(info?.Phase2Current?.value);
  const i3 = num(info?.Phase3Current?.value);
  const anyI = [i1, i2, i3].some((i) => !Number.isNaN(i) && i > 0.5);
  if (anyI) return "active";

  return fallback;
}

const justNumber = (id) => String(id).match(/\d+/)?.[0] ?? id;

export default function FactoryMap({
  selectedZone,
  onChangeZone,          // <-- opcional: passa setSelectedZone aqui
  onSelectMachine,
  machineData,
  selectedMachine,
  placementCandidateId,   // colocar nova
  onPlace,                // ({ id, x, y, zone })
  relocateCandidateId,    // mover existente
  onRelocate,             // ({ id, x, y, zone })
}) {
  const containerRef = useRef(null);

  const layoutData = getEffectiveLayout();
  const zoneData = layoutData[selectedZone];
  if (!zoneData) return <p>Zone not found.</p>;

  // imagem pode vir de assets (require), data URL ou http(s)
  let backgroundImage;
  const img = zoneData.image;
  if (img?.startsWith?.("data:") || img?.startsWith?.("http")) {
    backgroundImage = img;
  } else {
    try {
      backgroundImage = require(`../assets/${img}`);
    } catch {
      backgroundImage = img; // fallback (ex.: /uploads/…)
    }
  }

  // dimensões base informadas pela zona (ou defaults)
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
  const machines = zoneData.machines || {};

  // escolhe próxima zona para focar após remoção
  function pickNextZone(current) {
    const all = listZones().filter(z => z !== current);
    return all[0] || null;
  }

  return (
    <div
      ref={containerRef}
      className="factory-map"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "contain",          // mantém proporção
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        aspectRatio: `${baseW} / ${baseH}`, // zona responsiva
        width: "100%",
        maxWidth: "1100px",
        height: "auto",
        position: "relative",
        border: "1px solid #ccc",
        borderRadius: "10px",
        cursor: placing || relocating ? "crosshair" : "default",
        marginInline: "auto",
      }}
      onClick={handleMapClick}
      title={
        placing ? "Click to place machine"
        : relocating ? "Click to move machine"
        : undefined
      }
    >
      {/* Botão para remover zona (só para zonas criadas no overlay) */}
      {isRemovableZone(selectedZone) && (
        <button
          className="map-remove-zone"
          title={`Remove zone ${selectedZone}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!window.confirm(`Remove zone "${selectedZone}"?`)) return;
            const next = pickNextZone(selectedZone);
            if (removeZone(selectedZone)) {
              onChangeZone?.(next);
            }
          }}
        >
          Remove zone {selectedZone}
        </button>
      )}

      {Object.entries(machines).map(([id, data]) => {
        const info = machineData?.[id];
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
            className={`machine ${status} ${isSelected ? "selected" : ""}`}
            title={tooltipText}
            style={{ top: `${topPct}%`, left: `${leftPct}%` }}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelectMachine?.(id);
            }}
          >
            <div className="machine-tile">
              <Cog className="machine-icon" />
            </div>
            <span className="machine-num">{justNumber(id)}</span>
          </div>
        );
      })}

      {/* Legenda fixa no canto inferior-esquerdo */}
      <div className="map-legend">
        <span><div className="legend-dot legend-active" /> Active</span>
        <span><div className="legend-dot legend-inactive" /> Inactive</span>
        <span><div className="legend-dot legend-selected" /> Selected</span>
        {placing && <span>• Placing: {placementCandidateId}</span>}
        {relocating && <span>• Moving: {relocateCandidateId}</span>}
      </div>
    </div>
  );
}
