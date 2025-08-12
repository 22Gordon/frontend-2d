import React, { useEffect, useMemo, useState } from "react";
import { fetchOrionMachineIds } from "../services/orion";
import { getEffectiveLayout, listLayoutMachineIds } from "../utils/layoutStore";

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
    for (const id of filtered) {
      (set.has(id) ? a : b).push(id);
    }
    return [
      a.sort((x, y) => Number(x) - Number(y)),
      b.sort((x, y) => Number(x) - Number(y)),
    ];
  }, [filtered, orionIds]);

  return (
    <div style={{ padding: 12, minWidth: 360, color: "#111" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "#fff",
          paddingBottom: 8,
          zIndex: 1,
          borderBottom: "1px solid #eee",
        }}
      >
        <h3 style={{ margin: "0 0 8px 0", color: "#111" }}>
          Add machine to zone {selectedZone}
        </h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ID…"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #dcdcdc",
            background: "#fff",
            color: "#111",
            outline: "none",
          }}
        />
      </div>

      {loading && <div style={{ padding: 8 }}>Loading…</div>}
      {err && <div style={{ color: "tomato", padding: 8 }}>Error: {err}</div>}

      {!loading && !err && (
        <>
          {fromOrion.length === 0 && fromLayoutOnly.length === 0 ? (
            <div style={{ padding: 8 }}>No machines available for this zone.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
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
    <div>
      <div style={{ fontSize: 12, color: "#666", margin: "6px 0 4px" }}>{title}</div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          border: "1px solid #eee",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fafafa",
        }}
      >
        {items.map((id, i) => (
          <li
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderBottom: i === items.length - 1 ? "none" : "1px solid #f2f2f2",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Machine {id}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 999,
                  border: "1px solid #e5e5e5",
                  background: "#fff",
                  color: "#444",
                }}
              >
                {badge}
              </span>
            </div>
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
    </div>
  );
}
