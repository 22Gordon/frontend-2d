import React from "react";

const mockSensorData = {
  "312": {
    status: "active",
    energy: "158.3 kWh",
    gas: "23.1 m³",
    distance: "1.2 m"
  },
  "313": {
    status: "inactive",
    energy: "0.0 kWh",
    gas: "0.0 m³",
    distance: "5.6 m"
  }
};

function MachineDetails({ machineId }) {
  if (!machineId) {
    return <div style={{ marginLeft: "40px" }}>Selecione uma máquina.</div>;
  }

  const data = mockSensorData[machineId];

  if (!data) {
    return <div style={{ marginLeft: "40px" }}>Dados não disponíveis.</div>;
  }

  return (
    <div style={{ marginLeft: "40px", backgroundColor: "#f5f5f5", padding: "20px", borderRadius: "8px", minWidth: "250px" }}>
      <h3>Máquina {machineId}</h3>
      <p><strong>Estado:</strong> {data.status === "active" ? "Ativa" : "Inativa"}</p>
      <p><strong>Consumo de Energia:</strong> {data.energy}</p>
      <p><strong>Consumo de Gás:</strong> {data.gas}</p>
      <p><strong>Distância:</strong> {data.distance}</p>
    </div>
  );
}

export default MachineDetails;
