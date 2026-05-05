import React, { useMemo } from "react";
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

  robot_mode: "Robot Mode",
  safety_mode: "Safety Mode",
  runtime_state: "Runtime State",
  speed_scaling: "Speed Scaling",
  payload: "Payload",
  actual_robot_voltage: "Robot Voltage",
  actual_robot_current: "Robot Current",
  actual_q: "Actual Joints",
  actual_TCP_pose: "TCP Pose",
  actual_TCP_speed: "TCP Speed",
  actual_TCP_force: "TCP Force",
  joint_temperatures: "Joint Temperatures",
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

  payload: "kg",
  actual_robot_voltage: "V",
  actual_robot_current: "A",
};

const ORDER = [
  "TotalActiveEnergy",
  "TotalApparentPower",
  "TotalReactiveEnergy",
  "TotalReactivePower",
  "TotalPower",
  "TotalPowerFactor",
  "Phase1Voltage",
  "Phase2Voltage",
  "Phase3Voltage",
  "Phase1Current",
  "Phase2Current",
  "Phase3Current",
  "Frequency",
  "Frequency2",
  "gasUsage",
  "distance",
];

const ROBOT_SUMMARY_ORDER = [
  "robot_mode",
  "safety_mode",
  "runtime_state",
  "speed_scaling",
  "payload",
  "actual_robot_voltage",
  "actual_robot_current",
  "actual_q",
  "actual_TCP_pose",
  "actual_TCP_speed",
  "actual_TCP_force",
  "joint_temperatures",
];

const EXCLUDED = new Set(["TimeInstant", "config", "device_info"]);

function fmtNumber(n, { max = 2 } = {}) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: max,
    minimumFractionDigits: 0,
  }).format(n);
}

function renderValue(key, v) {
  if (v === null || v === undefined) return "—";

  if (typeof v === "number") {
    const digits = Math.abs(v) >= 100 ? 0 : 2;
    const txt = fmtNumber(v, { max: digits });
    return `${txt}${UNITS[key] ? ` ${UNITS[key]}` : ""}`;
  }

  if (typeof v === "string") {
    return v;
  }

  if (Array.isArray(v) || typeof v === "object") {
    let pretty;
    try {
      pretty = JSON.stringify(v, null, 2);
    } catch {
      pretty = String(v);
    }

    return <code className="md-json">{pretty}</code>;
  }

  return String(v);
}

export default function MachineDetails({
  machineId,
  data,
  loading = false,
  error = null,
  onRetry,
  onOpenRobotDetails,
  Spinner,
  sticky = false,
  showRobotDetailsButton = false,
}) {
  const isRobotContext = useMemo(() => {
    const machineStr = String(machineId || "").toLowerCase();
    return (
      machineStr.includes("braco") ||
      machineStr.includes("robot") ||
      data?.actual_q?.value !== undefined ||
      data?.actual_TCP_pose?.value !== undefined ||
      data?.robot_mode?.value !== undefined
    );
  }, [machineId, data]);

  const entries = useMemo(() => {
    if (!data) return [];

    const arr = Object.entries(data).filter(([k, v]) => {
      if (EXCLUDED.has(k)) return false;
      if (v?.value === undefined) return false;
      if (v?.value === null || v?.value === "") return false;
      return true;
    });

    if (isRobotContext) {
      const allowed = new Set(ROBOT_SUMMARY_ORDER);

      return arr
        .filter(([k]) => allowed.has(k))
        .sort((a, b) => {
          const ia = ROBOT_SUMMARY_ORDER.indexOf(a[0]);
          const ib = ROBOT_SUMMARY_ORDER.indexOf(b[0]);
          return ia - ib;
        });
    }

    return arr.sort((a, b) => {
      const ia = ORDER.indexOf(a[0]);
      const ib = ORDER.indexOf(b[0]);
      const wa = ia === -1 ? 999 : ia;
      const wb = ib === -1 ? 999 : ib;
      if (wa !== wb) return wa - wb;
      return a[0].localeCompare(b[0]);
    });
  }, [data, isRobotContext]);

  const timestamp = data?.TimeInstant?.value ?? null;

  const canOpenDetails =
    !!machineId &&
    !!showRobotDetailsButton &&
    typeof onOpenRobotDetails === "function";

  if (!machineId) {
    return (
      <div className={`md-card ${sticky ? "md-sticky" : ""}`}>
        <p className="md-empty">Select a machine to view details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`md-card md-state ${sticky ? "md-sticky" : ""}`}>
        <div className="md-state-icon">
          {Spinner ? (
            <Spinner size={18} />
          ) : (
            <span className="md-css-spinner" aria-label="Loading" />
          )}
        </div>
        <div className="md-state-text">Loading data from Orion…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`md-card md-state md-state--error ${
          sticky ? "md-sticky" : ""
        }`}
        role="alert"
      >
        <div className="md-state-icon md-state-icon--error">!</div>
        <div className="md-state-text">Couldn’t load data: {error}</div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {onRetry && (
            <button className="btn btn--solid md-retry" onClick={onRetry}>
              Try again
            </button>
          )}
          {canOpenDetails && (
            <button
              className="btn md-retry md-open-details-btn"
              onClick={onOpenRobotDetails}
            >
              Robot details
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`md-card md-state ${sticky ? "md-sticky" : ""}`}>
        <div className="md-state-icon">ℹ️</div>
        <div className="md-state-text">No data yet.</div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {onRetry && (
            <button className="btn md-retry" onClick={onRetry}>
              Refresh
            </button>
          )}
          {canOpenDetails && (
            <button
              className="btn md-retry md-open-details-btn"
              onClick={onOpenRobotDetails}
            >
              Robot details
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`md-card ${sticky ? "md-sticky" : ""}`}>
      <div className="md-header-row">
        <h2 className="md-title" style={{ margin: 0 }}>
          Machine {machineId}
        </h2>

        {canOpenDetails && (
          <button
            type="button"
            className="btn btn--solid btn--sm md-open-details-btn"
            onClick={onOpenRobotDetails}
            title="Open robot details"
          >
            Robot details
          </button>
        )}
      </div>

      <div className="md-grid" role="table" aria-label="Machine metrics">
        {entries.map(([key, attr]) => (
          <React.Fragment key={key}>
            <div className="md-label" role="rowheader">
              {LABELS[key] || key}
            </div>
            <div className="md-value" role="cell">
              {renderValue(key, attr.value)}
            </div>
          </React.Fragment>
        ))}
      </div>

      {timestamp && (
        <div className="md-updated">
          Last updated: {new Date(timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}