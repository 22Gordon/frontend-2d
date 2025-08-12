import React from "react";
import layoutData from "../layout/layout.json";
import "./MachineDetails.css";

const LABELS = {
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

const UNITS = {
  Frequency: "Hz",
  Frequency2: "Hz",
  Phase1Voltage: "V",
  Phase2Voltage: "V",
  Phase3Voltage: "V",
  Phase1Current: "A",
  Phase2Current: "A",
  Phase3Current: "A",
  TotalPower: "W",
  TotalApparentPower: "VA",
  TotalReactivePower: "var",
  TotalActiveEnergy: "Wh",
  TotalReactiveEnergy: "varh",
  distance: "mm",
  gasUsage: "",
};

function formatValue(key, v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    const n = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
    return `${n}${UNITS[key] ? ` ${UNITS[key]}` : ""}`;
  }
  return String(v);
}

export default function MachineDetails({ machineId, data }) {
  if (!machineId || !data) {
    return (
      <div className="md-card">
        <p className="md-empty">Select a machine to view details.</p>
      </div>
    );
  }

  const zone = layoutData[machineId]?.zone || "N/A";
  const timestamp = data?.TimeInstant?.value || null;

  const excluded = new Set(["TimeInstant", "config", "device_info"]);
  const order = [
    "TotalActiveEnergy","TotalApparentPower","TotalReactiveEnergy","TotalReactivePower",
    "TotalPower","TotalPowerFactor",
    "Phase1Voltage","Phase2Voltage","Phase3Voltage",
    "Phase1Current","Phase2Current","Phase3Current",
    "Frequency","Frequency2","gasUsage","distance"
  ];

  const entries = Object.entries(data)
    .filter(([k, v]) => !excluded.has(k) && v?.value !== undefined)
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));

  return (
    <div className="md-card">
      <h2 className="md-title">Machine {machineId}</h2>

      <div className="md-zone">
        <span className="md-zone-label">Zone:</span> {zone}
      </div>

      <div className="md-grid">
        {entries.map(([key, attr]) => (
          <React.Fragment key={key}>
            <div className="md-label">{LABELS[key] || key}</div>
            <div className="md-value">{formatValue(key, attr.value)}</div>
          </React.Fragment>
        ))}
      </div>

      {timestamp && (
        <div className="md-updated">
          Last updated: {new Date(timestamp).toLocaleString("en-GB")}
        </div>
      )}
    </div>
  );
}
