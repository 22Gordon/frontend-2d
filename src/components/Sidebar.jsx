import React from "react";
import "./Sidebar.css";

function Sidebar({ machines, selectedMachine, onSelectMachine }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Adalberto</h2>
        <button className="sidebar-filter-button">Filter by machine</button>
      </div>

      <div className="machine-list">
        {machines.map((id) => {
          const isSelected = selectedMachine === id;
          return (
            <div
              key={id}
              className={`machine-item ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectMachine(id)}
            >
              <span>{`Machine ${id}`}</span>
              <button className="edit-button">✏️</button>
            </div>
          );
        })}
      </div>

      <button className="add-machine-button">+ Add machine</button>
    </div>
  );
}

export default Sidebar;
