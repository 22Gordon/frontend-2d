import React from "react";
import "./Sidebar.css";
import "../styles/ui.css";

export default function Sidebar({ machines, selectedMachine, onSelectMachine, onAddMachine }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Adalberto</h2>
        <button className="btn btn--ghost">Filter by machine</button>
      </div>

      <div className="list">
        {machines.map(id => {
          const isSel = selectedMachine === id;
          return (
            <div
              key={id}
              className={`list-item ${isSel ? "selected" : ""}`}
              onClick={() => onSelectMachine(id)}
            >
              <span>{`Machine ${id}`}</span>
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
