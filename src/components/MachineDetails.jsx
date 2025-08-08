import React from "react";

function MachineDetails({ machineId, data }) {
  if (!machineId || !data) return <p style={{ paddingTop: 40 }}>Selecione uma máquina.</p>;

  return (
    <div
      style={{
        background: "#f9f9f9",
        borderRadius: 10,
        padding: 30,
        maxWidth: 300,
        fontFamily: "Arial",
      }}
    >
      <h2 style={{ marginBottom: 20 }}>Máquina {machineId}</h2>

      {/* Exemplo de atributo fictício para estado */}
      {data.status && (
        <p>
          <strong>Estado:</strong> {data.status.value === "active" ? "Ativa" : "Inativa"}
        </p>
      )}

      {data.TotalActiveEnergy && (
        <p>
          <strong>Consumo de Energia:</strong> {data.TotalActiveEnergy.value} kWh
        </p>
      )}

      {data.gasUsage && (
        <p>
          <strong>Consumo de Gás:</strong> {data.gasUsage.value} m³
        </p>
      )}

      {data.distance && (
        <p>
          <strong>Distância:</strong> {data.distance.value} m
        </p>
      )}
    </div>
  );
}

export default MachineDetails;
