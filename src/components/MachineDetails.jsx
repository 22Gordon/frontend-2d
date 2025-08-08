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
      {Object.entries(data).map(([key, attr]) => (
        attr?.value !== undefined && (
          <p key={key}>
            <strong>{key}:</strong> {attr.value.toString()}
          </p>
        )
      ))}
    </div>
  );
}

export default MachineDetails;