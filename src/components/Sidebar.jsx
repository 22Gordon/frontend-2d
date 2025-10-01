// Sidebar.jsx
import React, { useMemo, useState } from "react";
import "./Sidebar.css";
import "../styles/ui.css";

export default function Sidebar({
  machines,             // array de IDs (ex.: ["311","312"] ou ["emeter-311", ...])
  selectedMachine,
  onSelectMachine,
  onAddMachine,
}) {
  const [query, setQuery] = useState("");

  // normaliza para facilitar o match (aceita "312" e dá match em "emeter-312")
  const norm = (id) => String(id).toLowerCase();
  const justNumber = (id) => String(id).match(/\d+/)?.[0] ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return machines;

    return machines.filter((id) => {
      const full = norm(id);           // ex.: "emeter-312"
      const num = justNumber(id);      // ex.: "312"
      return full.includes(q) || num.includes(q);
    });
  }, [machines, query]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Adalberto</h2>
      </div>

      {/* Filter by machine */}
      <div className="sidebar-filter">
        <label className="filter-label">Filter by machine</label>
        <input
          className="input"
          type="text"
          placeholder="e.g., 312"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="list">
        {filtered.map((id) => {
          const isSel = selectedMachine === id;
          return (
            <div
              key={id}
              className={`list-item ${isSel ? "selected" : ""}`}
              onClick={() => onSelectMachine(id)}
            >
              <span>{`Machine ${justNumber(id) || id}`}</span>
              <button className="icon-btn" title="Edit">✏️</button>
            </div>
          );
        })}
      </div>

      <button
        className="btn"
        style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
        onClick={onAddMachine}
      >
        + Add machine
      </button>
    </div>
  );
}
