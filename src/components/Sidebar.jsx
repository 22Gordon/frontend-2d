// Sidebar.jsx
import React, { useMemo, useState } from "react";
import "./Sidebar.css";
import "../styles/ui.css";

export default function Sidebar({
  machines,
  selectedMachine,
  onSelectMachine,
  onAddMachine,
  onMoveMachine,    // novo callback
  onRemoveMachine,  // novo callback
}) {
  const [query, setQuery] = useState("");

  const justNumber = (id) => String(id).match(/\d+/)?.[0] ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return machines;
    return machines.filter((id) => {
      const full = id.toLowerCase();
      const num = justNumber(id);
      return full.includes(q) || num.includes(q);
    });
  }, [machines, query]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Adalberto</h2>
      </div>

      {/* Filtro */}
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

              <div className="actions">
                {/* Botão mover */}
                <button
                  className="icon-btn"
                  title="Move"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveMachine?.(id);
                  }}
                >
                  ✏️
                </button>

                {/* Botão remover */}
                <button
                  className="icon-btn"
                  title="Remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Remove machine ${id}?`)) {
                      onRemoveMachine?.(id);
                    }
                  }}
                >
                  🗑️
                </button>
              </div>
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
