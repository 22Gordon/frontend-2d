import React, { useEffect, useState } from "react";
import { fetchOrionMachineIds } from "../services/orion";
import { getEffectiveLayout, listLayoutMachineIds } from "../utils/layoutStore";

export default function AddMachinePanel({ selectedZone, onEnterPlaceMode }) {
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // 1) IDs vindos do Orion (via sensores)
        const orionIds = await fetchOrionMachineIds();

        // 2) IDs existentes no layout (todas as zonas)
        const layoutAllIds = listLayoutMachineIds();

        // 3) União (Orion ∪ Layout)
        const union = Array.from(new Set([...orionIds, ...layoutAllIds]));

        // 4) Excluir os que já estão na zona selecionada
        const layout = getEffectiveLayout();
        const idsInThisZone = Object.keys(layout[selectedZone]?.machines || {});
        const diff = union.filter((id) => !idsInThisZone.includes(id));

        if (mounted) setAvailable(diff);
      } catch (e) {
        if (mounted) setErr(e.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedZone]);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ marginBottom: 8 }}>Add machine to zone {selectedZone}</h3>
      {loading && <div>Loading…</div>}
      {err && <div style={{ color: "tomato" }}>Error: {err}</div>}
      {!loading && !err && (
        <>
          {available.length === 0 ? (
            <div>No machines available for this zone.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {available.map((id) => (
                <li
                  key={id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    borderBottom: "1px solid #222",
                  }}
                >
                  <span>Machine {id}</span>
                  <button
                    className="btn"
                    onClick={() => onEnterPlaceMode(id)}
                    title="Click and then pick a position on the map"
                  >
                    Place on map
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
