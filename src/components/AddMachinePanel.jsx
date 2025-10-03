import React, { useEffect, useMemo, useState } from "react";
import { fetchOrionMachineIds } from "../services/orion";
import { getEffectiveLayout, listLayoutMachineIds } from "../utils/layoutStore";
import "./AddMachinePanel.css";

export default function AddMachinePanel({ selectedZone, onEnterPlaceMode }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [orionIds, setOrionIds] = useState([]);
  const [available, setAvailable] = useState([]); // união Orion+Layout que NÃO está nesta zona
  const [q, setQ] = useState(""); // search

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [idsFromOrion, layoutAllIds] = await Promise.all([
          fetchOrionMachineIds(),
          Promise.resolve(listLayoutMachineIds()),
        ]);

        const union = Array.from(new Set([...idsFromOrion, ...layoutAllIds]));
        const layout = getEffectiveLayout();
        const idsInThisZone = Object.keys(layout[selectedZone]?.machines || {});
        const diff = union.filter((id) => !idsInThisZone.includes(id));

        if (!mounted) return;
        setOrionIds(idsFromOrion);
        setAvailable(diff);
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

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return available;
    return available.filter((id) => id.includes(t));
  }, [available, q]);

  // separar em 2 secções: vem do Orion vs só do Layout
  const [fromOrion, fromLayoutOnly] = useMemo(() => {
    const set = new Set(orionIds);
    const a = [], b = [];
    for (const id of filtered) (set.has(id) ? a : b).push(id);
    const ascNum = (x, y) => Number(x) - Number(y);
    return [a.sort(ascNum), b.sort(ascNum)];
  }, [filtered, orionIds]);

  return (
    <div className="amp">
      <div className="amp-header">
        <h3 className="amp-title">Add machine to zone {selectedZone}</h3>
        <div className="amp-search">
          <span className="amp-search-ico" aria-hidden>🔎</span>
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
          {fromOrion.length === 0 && fromLayoutOnly.length === 0 ? (
            <div className="amp-state">No machines available for this zone.</div>
          ) : (
            <div className="amp-sections">
              {fromOrion.length > 0 && (
                <Section
                  title={`From Orion (${fromOrion.length})`}
                  items={fromOrion}
                  badge="Orion"
                  onEnterPlaceMode={onEnterPlaceMode}
                />
              )}
              {fromLayoutOnly.length > 0 && (
                <Section
                  title={`From layout (other zones) (${fromLayoutOnly.length})`}
                  items={fromLayoutOnly}
                  badge="Layout"
                  onEnterPlaceMode={onEnterPlaceMode}
                />
              )}
            </div>
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
        {items.map((id, i) => (
          <li
            key={id}
            className="amp-item"
          >
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
