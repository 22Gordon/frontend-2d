import React from "react";
import layoutData from "../layout/layout.json";

// Mapping for user-friendly attribute labels
const readableLabels = {
  Frequency: "Frequency",
  Frequency2: "Frequency 2",
  NeutralCurrent: "Neutral Current",
  Phase1Current: "Phase 1 Current",
  Phase1Voltage: "Phase 1 Voltage",
  Phase2Current: "Phase 2 Current",
  Phase2Voltage: "Phase 2 Voltage",
  Phase3Current: "Phase 3 Current",
  Phase3Voltage: "Phase 3 Voltage",
  TotalActiveEnergy: "Total Active Energy",
  TotalApparentPower: "Total Apparent Power",
  TotalPower: "Total Power",
  TotalPowerFactor: "Power Factor",
  TotalReactiveEnergy: "Total Reactive Energy",
  TotalReactivePower: "Total Reactive Power",
  distance: "Distance",
  gasUsage: "Gas Usage",
};

function MachineDetails({ machineId, data }) {
  if (!machineId || !data)
    return <p style={{ paddingTop: 40 }}>Please select a machine.</p>;

  const zone = layoutData[machineId]?.zone || "N/A";
  const timestamp = data?.TimeInstant?.value || null;

  const excludedKeys = ["TimeInstant", "config", "device_info"];

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
      <h2 style={{ marginBottom: 20 }}>Machine {machineId}</h2>

      <p>
        <strong>Zone:</strong> {zone}
      </p>

      {Object.entries(data)
        .filter(([key]) => !excludedKeys.includes(key))
        .map(([key, attr]) => (
          attr?.value !== undefined && (
            <p key={key}>
              <strong>{readableLabels[key] || key}:</strong>{" "}
              {typeof attr.value === "object"
                ? JSON.stringify(attr.value)
                : attr.value.toString()}
            </p>
          )
        ))}

      {timestamp && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
          Last updated: {new Date(timestamp).toLocaleString("en-GB")}
        </p>
      )}
    </div>
  );
}

export default MachineDetails;
