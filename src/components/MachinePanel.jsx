import React from "react";

function MachinePanel({ machineId, data }) {
  if (!machineId) return null;

  return (
    <div style={{
      position: "absolute", top: 20, right: 20, padding: "20px",
      background: "#1e1e1e", color: "white", borderRadius: "10px", width: "300px"
    }}>
      <h3>Machine {machineId}</h3>
      <p>Status: {data.status}</p>
      <p>Zone: {data.zone}</p>
      {/* futuramente: dados de sensores aqui */}
    </div>
  );
}

export default MachinePanel;
