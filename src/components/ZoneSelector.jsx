import React, { useEffect, useState } from "react";
import "./ZoneSelector.css";
import AddZonePanel from "./AddZonePanel";
import { getEffectiveLayout, exportEffectiveLayoutAsJson } from "../utils/layoutStore";

export default function ZoneSelector({ selectedZone, onChangeZone }) {
  const [showAdd, setShowAdd] = useState(false);
  const [version, setVersion] = useState(0);

  // Re-render quando o layout muda + corrige a seleção se a zona foi removida
  useEffect(() => {
    const onUpd = () => {
      const zonesNow = Object.keys(getEffectiveLayout());
      if (!zonesNow.includes(selectedZone) && zonesNow.length > 0) {
        onChangeZone?.(zonesNow[0]); // muda para a primeira zona existente
      }
      setVersion(v => v + 1);
    };
    window.addEventListener("layout:updated", onUpd);
    return () => window.removeEventListener("layout:updated", onUpd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZone]);

  const layout = getEffectiveLayout();
  const zones = Object.keys(layout);

  return (
    <div className="chipbar">
      {zones.map((z) => (
        <button
          key={z}
          className={`chip ${selectedZone === z ? "is-active" : ""}`}
          onClick={() => onChangeZone?.(z)}
          title={`Zone ${z}`}
        >
          Zone {z}
        </button>
      ))}

      {/* ações (sem o botão de apagar) */}
      <button className="chip" onClick={() => setShowAdd(true)} title="Add zone">+</button>
      <button className="chip" onClick={() => exportEffectiveLayoutAsJson()} title="Export layout">⤓</button>

      {showAdd && (
        <div style={{ marginTop: 8 }}>
          <AddZonePanel onClose={() => setShowAdd(false)} />
        </div>
      )}
    </div>
  );
}
