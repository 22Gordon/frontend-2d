// Sidebar.jsx
import React, { useMemo, useState } from "react";
import "./Sidebar.css";

export default function Sidebar({
  machines,
  selectedMachine,
  onSelectMachine,
  onAddMachine,
  onMoveMachine,
  onRemoveMachine,
}) {
  const [query, setQuery] = useState("");

  const justNumber = (id) => String(id).match(/\d+/)?.[0] ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter((id) => {
      const full = String(id).toLowerCase();
      const num = justNumber(id);
      return full.includes(q) || num.includes(q);
    });
  }, [machines, query]);

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h2 className="sidebar-title">Adalberto</h2>
      </div>

      {/* Search */}
      <div className="sidebar-filter">
        <label className="filter-label">Filter by machine</label>
        <div className="input-wrap">
          <span className="search-ico" aria-hidden>🔎</span>
          <input
            className="input"
            type="text"
            placeholder="e.g., 312"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter machines"
          />
        </div>
      </div>

      {/* List */}
      <div className="list">
        {filtered.map((id) => {
          const isSel = selectedMachine === id;

          return (
            <div
              key={id}
              className={`list-item ${isSel ? "selected" : ""}`}
              onClick={() => onSelectMachine?.(id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelectMachine?.(id)}
            >
              <span className="item-label">{`Machine ${justNumber(id) || id}`}</span>

              <div className="actions">
                <button
                  className="icon-btn"
                  title="Move"
                  onClick={(e) => { e.stopPropagation(); onMoveMachine?.(id); }}
                  aria-label={`Move ${id}`}
                >
                  ✏️
                </button>
                <button
                  className="icon-btn"
                  title="Remove"
                  onClick={(e) => { e.stopPropagation(); onRemoveMachine?.(id); }}
                  aria-label={`Remove ${id}`}
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="empty">No machines found.</div>}
      </div>

      {/* Add */}
      <button className="btn" onClick={onAddMachine}>+ Add machine</button>
    </aside>
  );
}
