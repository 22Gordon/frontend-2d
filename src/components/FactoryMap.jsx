import React from "react";
import layoutData from "../layout/layout.json";
import "../components/FactoryMap.css";

function FactoryMap({ selectedZone, onSelectMachine, machineData }) {
  const zoneData = layoutData[selectedZone];

  if (!zoneData) return <p>Zona não encontrada.</p>;

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
        const machineInfo = machineData[id];
        const status = machineInfo?.status || data.status || "inactive";

        return (
          <div
            key={id}
            className={`machine ${status === "active" ? "active" : "inactive"}`}
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
              boxShadow: "0 0 4px rgba(0,0,0,0.3)",
            }}
            onClick={() => onSelectMachine(id)}
          >
            {id}
          </div>
        );
      })}
    </div>
  );
}

export default FactoryMap;
