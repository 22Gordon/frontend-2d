import React, { useEffect, useState } from "react";
import "./ZoneSelector.css";
import AddZonePanel from "./AddZonePanel";
import Modal from "./Modal";
import { getEffectiveLayout, exportEffectiveLayoutAsJson } from "../utils/layoutStore";

export default function ZoneSelector({ selectedZone, onChangeZone }) {
  const [showAdd, setShowAdd] = useState(false);

  // Re-render e corrige seleção se a zona desaparecer (ex.: delete)
  useEffect(() => {
    const onUpd = () => {
      const zonesNow = Object.keys(getEffectiveLayout());
      if (!zonesNow.includes(selectedZone) && zonesNow.length > 0) {
        onChangeZone?.(zonesNow[0]);
      }
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
          type="button"
          className={`chip ${selectedZone === z ? "is-active" : ""}`}
          onClick={() => onChangeZone?.(z)}
          title={`Zone ${z}`}
        >
          Zone {z}
        </button>
      ))}

      <button
        type="button"
        className="chip"
        onClick={() => setShowAdd(true)}
        title="Add zone"
        aria-label="Add zone"
      >
        +
      </button>

      <button
        type="button"
        className="chip"
        onClick={() => exportEffectiveLayoutAsJson()}
        title="Export layout"
        aria-label="Export layout"
      >
        ⤓
      </button>

      {/*Passamos open ao Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>Add zone</h3>
        <AddZonePanel onClose={() => setShowAdd(false)} />
      </Modal>
    </div>
  );
}
