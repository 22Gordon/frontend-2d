import React from "react";
import layoutData from "../layout/layout.json";
import "../components/FactoryMap.css";

function FactoryMap({ selectedZone, onSelectMachine, machineData, selectedMachine }) {
  const zoneData = layoutData[selectedZone];
  if (!zoneData) return <p>Zone not found.</p>;

  const backgroundImage = require(`../assets/${zoneData.image}`);
  const machines = zoneData.machines;

  return (
    <div
      className="factory-map"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        width: "800px",
        height: "600px",
        position: "relative",
        border: "1px solid #ccc",
        borderRadius: "10px",
      }}
    >
      {Object.entries(machines).map(([id, data]) => {
        const info = machineData[id];
        const status = info?.status || data.status || "inactive";
        const isSelected = selectedMachine === id;

        const energy = info?.TotalActiveEnergy?.value;
        const updated = info?.TimeInstant?.value;
        const tooltipText = [
          `ID: ${id}`,
          `Status: ${status}`,
          energy != null
            ? `Energy: ${Number(energy).toLocaleString("en-GB", { maximumFractionDigits: 2 })} Wh`
            : null,
          updated ? `Updated: ${new Date(updated).toLocaleString("en-GB")}` : null,
        ].filter(Boolean).join("\n");

        return (
          <div
            key={id}
            className={`machine ${status === "active" ? "active" : "inactive"} ${isSelected ? "selected" : ""}`}
            title={tooltipText}
            style={{
              position: "absolute",
              top: data.position.y,
              left: data.position.x,
              width: 30,
              height: 30,
              borderRadius: 20,
              backgroundColor: status === "active" ? "green" : "red",
              color: "#fff",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: isSelected ? "3px solid #00bfff" : "none",
              boxShadow: isSelected ? "0 0 8px #00bfff" : "0 0 4px rgba(0,0,0,0.3)",
              transform: isSelected ? "scale(1.1)" : "scale(1)",
              zIndex: isSelected ? 2 : 1,
              transition: "all 0.2s ease-in-out",
            }}
            onClick={() => onSelectMachine(id)}
          >
            {id}
          </div>
        );
      })}

      {/* Legenda */}
      <div className="map-legend">
        <span><div style={{ width: 12, height: 12, background: "green", borderRadius: "50%" }} /></span> Active
        <span style={{ marginLeft: 10 }}><div style={{ width: 12, height: 12, background: "red", borderRadius: "50%" }} /></span> Inactive
        <span style={{ marginLeft: 10 }}><div style={{ width: 12, height: 12, border: "2px solid #00bfff", borderRadius: "50%" }} /></span> Selected
      </div>
    </div>
  );
}
export default FactoryMap;
