// src/components/AddMachinePanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchOrionMachineIds } from "../services/orion";
import { getEffectiveLayout } from "../utils/layoutStore";
import { useOrionConfig } from "../context/OrionConfigContext";
import "./AddMachinePanel.css";

export default function AddMachinePanel({ selectedZone, onEnterPlaceMode }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [availableIds, setAvailableIds] = useState([]);
  const [q, setQ] = useState("");

  // 👇 config específica da zona (service, servicePath, entityPrefixes)
  const { config: orionConfig } = useOrionConfig(selectedZone);
  const { fiwareService, fiwareServicePath, entityPrefixes } = orionConfig;

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // 1) IDs lógicos que existem no Orion para ESTE serviço/servicePath/prefixes
        const idsFromOrion = await fetchOrionMachineIds({
          fiwareService,
          fiwareServicePath,
          entityPrefixes,
        });

        // 2) IDs já colocados nesta zona, para não repetir
        const layout = getEffectiveLayout();
        const idsInThisZone = Object.keys(layout[selectedZone]?.machines || {});

        const available = idsFromOrion.filter(
          (id) => !idsInThisZone.includes(id)
        );

        if (!mounted) return;
        setAvailableIds(available);
      } catch (e) {
        if (mounted) setErr(e.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedZone, fiwareService, fiwareServicePath, entityPrefixes]);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return availableIds;
    return availableIds.filter((id) => id.includes(t));
  }, [availableIds, q]);

  // ordenar IDs (numéricos ou string)
  const sorted = useMemo(() => {
    const copy = [...filtered];
    const asc = (x, y) => {
      const nx = Number(x);
      const ny = Number(y);
      if (!Number.isNaN(nx) && !Number.isNaN(ny)) return nx - ny;
      return x.localeCompare(y);
    };
    return copy.sort(asc);
  }, [filtered]);

  return (
    <div className="amp">
      <div className="amp-header">
        <h3 className="amp-title">Add machine to zone {selectedZone}</h3>
        <div className="amp-search">
          <span className="amp-search-ico" aria-hidden>
            🔎
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID…"
            className="amp-input"
            aria-label="Search machine ID"
          />
        </div>
      </div>

      {loading && <div className="amp-state">Loading…</div>}
      {err && <div className="amp-state amp-error">Error: {err}</div>}

      {!loading && !err && (
        <>
          {sorted.length === 0 ? (
            <div className="amp-state">
              No machines available from Orion for this zone.
            </div>
          ) : (
            <Section
              title={`From Orion (${sorted.length})`}
              items={sorted}
              badge="Orion"
              onEnterPlaceMode={onEnterPlaceMode}
            />
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, items, badge, onEnterPlaceMode }) {
  return (
    <section className="amp-section">
      <div className="amp-section-title">{title}</div>
      <ul className="amp-list">
        {items.map((id) => (
          <li key={id} className="amp-item">
            <div className="amp-left">
              <span className="amp-machine">Machine {id}</span>
              <span className="amp-badge">{badge}</span>
            </div>
            <button
              className="amp-btn"
              onClick={() => onEnterPlaceMode(id)}
              aria-label={`Place machine ${id} on map`}
            >
              Place on map
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
