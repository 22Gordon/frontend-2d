import React, { useEffect, useState } from "react";
import layoutData from "../layout/layout.json";
import "./FactoryMap.css";

function FactoryMap({ onSelectMachine, machineData }) {
  const [machines, setMachines] = useState({});

  useEffect(() => {
    setMachines(layoutData);
  }, []);

  return (
    <div className="factory-map">
  {Object.entries(machines).map(([id, data]) => {
    const machineInfo = machineData[id];
    const status = machineInfo?.status || data.status || "inactive"; // prioridade: dados ao vivo > layout > default

    return (
      <div
        key={id}
        className={`machine ${status === "active" ? "active" : "inactive"}`}
        style={{
          top: data.position.y,
          left: data.position.x
        }}
        onClick={() => onSelectMachine(id)}
      >
        <span className="machine-label">{id}</span>
      </div>
    );
  })}
</div>
  );
}

export default FactoryMap;
