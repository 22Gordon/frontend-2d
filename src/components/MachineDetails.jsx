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
};

const UNITS = {
  Frequency: "Hz", Frequency2: "Hz",
  Phase1Voltage: "V", Phase2Voltage: "V", Phase3Voltage: "V",
  Phase1Current: "A", Phase2Current: "A", Phase3Current: "A",
  TotalPower: "W", TotalApparentPower: "VA", TotalReactivePower: "var",
  TotalActiveEnergy: "Wh", TotalReactiveEnergy: "varh",
  distance: "mm", gasUsage: "",
};

const ORDER = [
  "TotalActiveEnergy","TotalApparentPower","TotalReactiveEnergy","TotalReactivePower",
  "TotalPower","TotalPowerFactor",
  "Phase1Voltage","Phase2Voltage","Phase3Voltage",
  "Phase1Current","Phase2Current","Phase3Current",
  "Frequency","Frequency2","gasUsage","distance"
];

/* Nº profissional: separador de milhar e casas decimais “inteligentes” */
function fmtNumber(n, { max = 2 } = {}) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: max,
    minimumFractionDigits: 0
  }).format(n);
}

function formatValue(key, v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    const digits = Math.abs(v) >= 100 ? 0 : 2;
    const txt = fmtNumber(v, { max: digits });
    return `${txt}${UNITS[key] ? ` ${UNITS[key]}` : ""}`;
  }
  return String(v);
}

export default function MachineDetails({
  machineId,
  data,
  loading = false,
  error = null,
  onRetry,
  Spinner,
  sticky = false,   // <-- podes passar sticky={true} se quiseres “colar” o card
}) {
  // HOOKS no topo
  const excluded = new Set(["TimeInstant", "config", "device_info"]);

  const entries = useMemo(() => {
    if (!data) return [];
    const arr = Object.entries(data).filter(
      ([k, v]) => !excluded.has(k) && v?.value !== undefined
    );
    // ordenação estável: os não listados em ORDER vão para o fim por ordem alfabética
    return arr.sort((a, b) => {
      const ia = ORDER.indexOf(a[0]);
      const ib = ORDER.indexOf(b[0]);
      const wa = ia === -1 ? 999 : ia;
      const wb = ib === -1 ? 999 : ib;
      if (wa !== wb) return wa - wb;
      return a[0].localeCompare(b[0]);
    });
  }, [data]);

  const timestamp = data?.TimeInstant?.value ?? null;

  // Renders condicionais
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
          {Spinner ? <Spinner size={18} /> : <span className="md-css-spinner" aria-label="Loading" />}
        </div>
        <div className="md-state-text">Loading data from Orion…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`md-card md-state md-state--error ${sticky ? "md-sticky" : ""}`} role="alert">
        <div className="md-state-icon md-state-icon--error">!</div>
        <div className="md-state-text">Couldn’t load data: {error}</div>
        {onRetry && <button className="btn btn--solid md-retry" onClick={onRetry}>Try again</button>}
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`md-card md-state ${sticky ? "md-sticky" : ""}`}>
        <div className="md-state-icon">ℹ️</div>
        <div className="md-state-text">No data yet.</div>
        {onRetry && <button className="btn md-retry" onClick={onRetry}>Refresh</button>}
      </div>
    );
  }

  // Dados OK
  return (
    <div className={`md-card ${sticky ? "md-sticky" : ""}`}>
      <h2 className="md-title">Machine {machineId}</h2>

      <div className="md-grid" role="table" aria-label="Machine metrics">
        {entries.map(([key, attr]) => (
          <React.Fragment key={key}>
            <div className="md-label" role="rowheader">{LABELS[key] || key}</div>
            <div className="md-value" role="cell">{formatValue(key, attr.value)}</div>
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
