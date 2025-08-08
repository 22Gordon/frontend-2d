import React from "react";
import layoutData from "../layout/layout.json";

function MachineDetails({ machineId, data }) {
  if (!machineId || !data) return <p style={{ paddingTop: 40 }}>Selecione uma máquina.</p>;

  const zone = layoutData[machineId]?.zone || "N/A";
  const timestamp = data?.TimeInstant?.value || null;

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

      <p>
        <strong>Zona:</strong> {zone}
      </p>

      {Object.entries(data).map(([key, attr]) => (
        key !== "TimeInstant" && attr?.value !== undefined && (
          <p key={key}>
            <strong>{key}:</strong>{" "}
            {typeof attr.value === "object"
              ? JSON.stringify(attr.value)
              : attr.value.toString()}
          </p>
        )
      ))}

      {timestamp && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
          Última atualização: {new Date(timestamp).toLocaleString("pt-PT")}
        </p>
      )}
    </div>
  );
}

export default MachineDetails;
