import React, { useEffect, useMemo, useState } from "react";
import {
  listTasksFromOrion,
  deleteTaskFromOrion,
} from "../services/orionClientTasks";
import { listPointsFromOrion } from "../services/orionClientPoints";
import { createTaskRequestInOrion } from "../services/orionClientTaskRequests";
import {
  listProcessDefinitionsFromOrion,
  createProcessDefinitionInOrion,
  deleteProcessDefinitionFromOrion,
} from "../services/orionClientProcessDefinitions";

const UNITY_URL = import.meta.env?.VITE_UNITY_URL || "http://localhost:8001";

const ORCHESTRATOR_URL =
  import.meta.env?.VITE_ORCHESTRATOR_URL || "http://localhost:3005";

const CAMERA_URL =
  import.meta.env?.VITE_CAMERA_URL || "http://10.11.51.159:8080/stream";

/* -------------------- small utils -------------------- */
function normalizeStatus(s) {
  if (!s) return "";
  return String(s).trim().toLowerCase();
}

function statusColor(statusRaw) {
  const status = normalizeStatus(statusRaw);
  if (status === "executing" || status === "running") return "#f59e0b";
  if (status === "completed" || status === "done") return "#16a34a";
  if (status === "failed" || status === "error") return "#dc2626";
  return "#64748b";
}

function inferRobotNgsiId(machineId, machineData) {
  const maybeRobotId = machineData?.robotId;
  const maybeEntityId = machineData?.id;

  if (
    typeof maybeRobotId === "string" &&
    maybeRobotId.startsWith("RoboticArm:")
  ) {
    return maybeRobotId;
  }

  if (
    typeof maybeEntityId === "string" &&
    maybeEntityId.startsWith("RoboticArm:")
  ) {
    return maybeEntityId;
  }

  if (
    typeof maybeRobotId === "string" &&
    maybeRobotId.startsWith("Robot:")
  ) {
    return maybeRobotId;
  }

  if ((machineId || "").toLowerCase().includes("braco")) {
    return "RoboticArm:braco001";
  }

  return null;
}

async function executeTask(taskId) {
  const res = await fetch(
    `${ORCHESTRATOR_URL}/tasks/${encodeURIComponent(taskId)}/execute`,
    { method: "POST" }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Failed to execute task");
  return json;
}

async function deletePointViaOrchestrator(pointId) {
  const res = await fetch(
    `${ORCHESTRATOR_URL}/points/${encodeURIComponent(pointId)}`,
    { method: "DELETE" }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || "Failed to remove point");
  }
  return json;
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatStep(step) {
  if (!step) return "—";
  const action = step.action || "move";

  if (action === "move") {
    return `${action} → ${step.pointId || "—"}`;
  }

  if (action === "sleep") {
    return `${action} → ${step.seconds ?? 1}s`;
  }

  return action;
}

function getPointDisplayName(pointId, points) {
  if (!pointId) return "—";
  return points.find((p) => p.id === pointId)?.label || pointId;
}

function formatStepWithPoints(step, points) {
  if (!step) return "—";
  const action = step.action || "move";

  if (action === "move") {
    return `${action} → ${getPointDisplayName(step.pointId, points)}`;
  }

  if (action === "sleep") {
    return `${action} → ${step.seconds ?? 1}s`;
  }

  return action;
}

function getTaskProgressPct(task) {
  const v = task?.progressPct ?? task?.progress ?? 0;
  return Math.max(0, Math.min(100, safeNumber(v, 0)));
}

function getTaskCreatedAt(task) {
  return task?.createdAt || task?.requestedAt || task?.acceptedAt || "";
}

function cloneSteps(steps) {
  return Array.isArray(steps) ? steps.map((s) => ({ ...s })) : [];
}

function expandStepsByCount(steps, count) {
  const n = Math.max(1, Math.min(100, Number(count) || 1));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(...cloneSteps(steps));
  }
  return out;
}

/* -------------------- Advanced builder helpers -------------------- */
function makeStep(action = "move", extra = {}) {
  if (action === "move") {
    return { action: "move", pointId: extra.pointId || "" };
  }
  if (action === "grip") {
    return { action: "grip" };
  }
  if (action === "release") {
    return { action: "release" };
  }
  if (action === "sleep") {
    return { action: "sleep", seconds: extra.seconds ?? 1 };
  }
  return { action: "move", pointId: extra.pointId || "" };
}

function makeMoveStep(pointId) {
  return makeStep("move", { pointId });
}

function isValidStep(step) {
  const action = String(step?.action || "").trim().toLowerCase();

  if (action === "move") {
    return String(step?.pointId || "").trim().length > 0;
  }

  if (action === "grip") return true;
  if (action === "release") return true;

  if (action === "sleep") {
    const seconds = Number(step?.seconds);
    return Number.isFinite(seconds) && seconds >= 0;
  }

  return false;
}

/* -------------------- UI primitives (inline styles) -------------------- */
const ui = {
  appShell: {
    height: "100vh",
    width: "100%",
    padding: 18,
    boxSizing: "border-box",
    overflow: "hidden",
    background:
      "radial-gradient(1200px 600px at 20% 0%, rgba(59,130,246,0.14), transparent 60%)," +
      "radial-gradient(1000px 600px at 90% 10%, rgba(16,185,129,0.10), transparent 55%)," +
      "linear-gradient(180deg, rgba(15,23,42,0.04), rgba(15,23,42,0.02))",
  },

  headerRow: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    marginBottom: 14,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
  },

  brand: { display: "flex", alignItems: "center", gap: 10 },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#3b82f6",
    boxShadow: "0 0 0 6px rgba(59,130,246,0.12)",
  },
  title: { fontWeight: 950, fontSize: 16, color: "#0f172a", letterSpacing: 0.2 },
  subtle: { fontSize: 12, color: "#64748b" },

  pill: (tone = "neutral") => {
    const base = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 10px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.08)",
      background: "rgba(255,255,255,0.75)",
      backdropFilter: "blur(8px)",
      fontSize: 12,
      fontWeight: 900,
      color: "#0f172a",
    };
    if (tone === "running") {
      return {
        ...base,
        border: "1px solid rgba(245,158,11,0.35)",
        background: "rgba(245,158,11,0.12)",
      };
    }
    if (tone === "idle") {
      return {
        ...base,
        border: "1px solid rgba(100,116,139,0.25)",
        background: "rgba(100,116,139,0.08)",
      };
    }
    return base;
  },

  closeBtn: {
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
    color: "#0f172a",
  },

  topActionBtn: {
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
    color: "#0f172a",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "380px minmax(0, 1fr) 340px",
    gap: 14,
    alignItems: "stretch",
    minHeight: 0,
    height: "calc(100vh - 110px)",
  },

  panel: {
    borderRadius: 18,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
    height: "100%",
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
    boxSizing: "border-box",
  },

  panelHeaderRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  panelTitle: { fontWeight: 950, color: "#0f172a" },

  card: {
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 18,
    background: "rgba(15,23,42,0.02)",
    padding: 12,
    flexShrink: 0,
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: { fontWeight: 950, fontSize: 13, color: "#0f172a" },

  segmented: {
    display: "inline-flex",
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    overflow: "hidden",
    background: "rgba(255,255,255,0.85)",
    flexShrink: 0,
  },
  segBtn: (active) => ({
    padding: "7px 11px",
    border: "none",
    background: active ? "rgba(59,130,246,0.14)" : "transparent",
    color: "#0f172a",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 950,
  }),

  label: { fontSize: 12, color: "#64748b", display: "grid", gap: 6 },
  input: {
    width: "100%",
    padding: "10px 11px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.92)",
    fontSize: 13,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "10px 11px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.92)",
    fontSize: 13,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
  },

  chipsRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: (active = false) => ({
    borderRadius: 999,
    padding: "7px 10px",
    border: "1px solid rgba(0,0,0,0.10)",
    background: active ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.85)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
    color: "#0f172a",
  }),

  divider: { height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" },

  primaryBtn: (disabled) => ({
    width: "100%",
    borderRadius: 16,
    padding: "12px 12px",
    border: "1px solid rgba(0,0,0,0.06)",
    background: disabled
      ? "rgba(59,130,246,0.35)"
      : "linear-gradient(180deg, #3b82f6, #2563eb)",
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 950,
    fontSize: 13,
    boxShadow: disabled ? "none" : "0 16px 30px rgba(37,99,235,0.25)",
  }),

  ghostBtn: (disabled) => ({
    borderRadius: 14,
    padding: "9px 10px",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.85)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 950,
    fontSize: 12,
    color: "#0f172a",
    opacity: disabled ? 0.55 : 1,
  }),

  stepList: {
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.92)",
    overflow: "hidden",
  },
  stepRow: {
    display: "grid",
    gridTemplateColumns: "26px 1fr 108px",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  stepIndex: { fontSize: 12, fontWeight: 950, color: "#64748b" },
  stepActions: { display: "flex", justifyContent: "flex-end", gap: 6 },
  iconBtn: (danger = false, disabled = false) => ({
    width: 32,
    height: 32,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.9)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 950,
    fontSize: 12,
    color: danger ? "#dc2626" : "#0f172a",
    opacity: disabled ? 0.45 : 1,
    display: "grid",
    placeItems: "center",
  }),

  tasksScroll: {
    position: "relative",
    marginTop: 12,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingRight: 6,
  },

  taskItem: (active) => ({
    textAlign: "left",
    borderRadius: 18,
    padding: "12px 12px",
    border: active ? "2px solid rgba(59,130,246,0.55)" : "1px solid rgba(0,0,0,0.08)",
    background: active
      ? "linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))"
      : "rgba(255,255,255,0.92)",
    cursor: "pointer",
    position: "relative",
    boxShadow: active ? "0 12px 28px rgba(37,99,235,0.10)" : "none",
    outline: "none",
  }),

  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: "rgba(15,23,42,0.08)",
    overflow: "hidden",
  },

  loadingOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(255,255,255,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    color: "#475569",
    zIndex: 2,
    borderRadius: 16,
    pointerEvents: "none",
  },

  execCta: (enabled) => ({
    width: "100%",
    borderRadius: 16,
    padding: "12px 12px",
    border: "1px solid rgba(0,0,0,0.06)",
    background: enabled
      ? "linear-gradient(180deg, rgba(22,163,74,1), rgba(21,128,61,1))"
      : "rgba(15,23,42,0.06)",
    color: enabled ? "white" : "#64748b",
    cursor: enabled ? "pointer" : "not-allowed",
    fontWeight: 950,
    boxShadow: enabled ? "0 16px 30px rgba(22,163,74,0.18)" : "none",
  }),

  heroFrame: {
    flex: 1,
    minHeight: 0,
    height: "100%",
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.03), rgba(15,23,42,0.01))",
    border: "1px solid rgba(0,0,0,0.06)",
    overflow: "hidden",
    padding: 0,
    boxSizing: "border-box",
  },

  unityFrame: {
    width: "100%",
    height: "100%",
    display: "block",
    border: "none",
    borderRadius: 18,
    background: "white",
  },

  sectionTitle: { fontWeight: 950, marginBottom: 10, color: "#0f172a" },
  kv: {
    fontSize: 13,
    color: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  k: { color: "#64748b" },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.34)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
  },

  modalCard: {
    width: "min(780px, 100%)",
    maxHeight: "85vh",
    overflow: "hidden",
    borderRadius: 22,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 28px 80px rgba(15,23,42,0.22)",
    display: "flex",
    flexDirection: "column",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 18px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },

  modalBody: {
    padding: 18,
    overflowY: "auto",
    display: "grid",
    gap: 12,
  },

  pointsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  pointRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.9)",
  },

  pointMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },

  codeTag: {
    fontSize: 11,
    fontWeight: 900,
    color: "#475569",
    background: "rgba(15,23,42,0.05)",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 999,
    padding: "4px 8px",
    display: "inline-flex",
    width: "fit-content",
  },

  dangerBtn: (disabled) => ({
    borderRadius: 14,
    padding: "9px 12px",
    border: "1px solid rgba(220,38,38,0.16)",
    background: "rgba(220,38,38,0.08)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 950,
    fontSize: 12,
    color: "#dc2626",
    opacity: disabled ? 0.55 : 1,
  }),
};

/* -------------------- Points Modal -------------------- */
function PointsModal({
  open,
  onClose,
  points,
  loadingPoints,
  pointsError,
  onRefresh,
  onRemove,
  removingPointId,
  robotNgsiId,
}) {
  if (!open) return null;

  return (
    <div style={ui.modalBackdrop} onClick={onClose}>
      <div style={ui.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={ui.modalHeader}>
          <div>
            <div style={{ ...ui.title, fontSize: 15 }}>Points</div>
            <div style={ui.subtle}>
              Current robot: {robotNgsiId || "No robot mapping"}
            </div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onRefresh}
              style={ui.ghostBtn(loadingPoints)}
              disabled={loadingPoints}
            >
              {loadingPoints ? "Refreshing…" : "Refresh"}
            </button>

            <button type="button" onClick={onClose} style={ui.closeBtn}>
              Close
            </button>
          </div>
        </div>

        <div style={ui.modalBody}>
          {pointsError && (
            <div style={{ color: "#dc2626", fontSize: 13 }}>
              {pointsError}
            </div>
          )}

          <div style={ui.subtle}>
            Manage reusable positions persisted in Orion. These points can be
            consumed by task creation and advanced steps.
          </div>

          <div style={ui.pointsList}>
            {points.length === 0 && !loadingPoints && (
              <div style={{ ...ui.card, ...ui.subtle }}>
                No points found for this robot.
              </div>
            )}

            {points.map((p) => {
              const isRemoving = removingPointId === p.id;
              const canRemove = ![
                "Point:HOME",
                "Point:PICK_A",
                "Point:PLACE_B",
                "Point:SAFE",
              ].includes(p.id);

              return (
                <div key={p.id} style={ui.pointRow}>
                  <div style={ui.pointMeta}>
                    <div style={{ fontWeight: 950, color: "#0f172a" }}>
                      {p.label || p.id}
                    </div>

                    <div style={ui.codeTag}>{p.id}</div>

                    <div
                      style={{
                        ...ui.subtle,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>Robot: {p.robotId || "—"}</span>
                      <span>•</span>
                      <span>Source: {p.source || "seed"}</span>
                      <span>•</span>
                      <span>
                        Joints: {Array.isArray(p.targetJoints) ? p.targetJoints.length : 0}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(p)}
                    disabled={!canRemove || isRemoving}
                    style={ui.dangerBtn(!canRemove || isRemoving)}
                    title={
                      canRemove
                        ? "Remove point"
                        : "Protected default point"
                    }
                  >
                    {!canRemove
                      ? "Protected"
                      : isRemoving
                      ? "Removing…"
                      : "Remove"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Component -------------------- */
export default function RobotDetailsModal({
  machineId,
  machineData,
  orionConfig,
  onClose,
}) {
  const robotNgsiId = useMemo(
    () => inferRobotNgsiId(machineId, machineData),
    [machineId, machineData]
  );

  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState(null);
  const [busyExecute, setBusyExecute] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const [points, setPoints] = useState([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointsError, setPointsError] = useState(null);
  const [pickPointId, setPickPointId] = useState("");
  const [placePointId, setPlacePointId] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [removingPointId, setRemovingPointId] = useState(null);

  const [createMode, setCreateMode] = useState("simple");
  const [steps, setSteps] = useState([]);
  const [processId, setProcessId] = useState("Process:pickplace-01");

  const [fastPollUntil, setFastPollUntil] = useState(0);
  const [tasksRefreshToken, setTasksRefreshToken] = useState(0);

  const [savedProcesses, setSavedProcesses] = useState([]);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [processesError, setProcessesError] = useState(null);
  const [busySaveProcess, setBusySaveProcess] = useState(false);
  const [busyDeleteProcessId, setBusyDeleteProcessId] = useState(null);

  const [selectedSavedProcessId, setSelectedSavedProcessId] = useState("");
  const [processName, setProcessName] = useState("");
  const [loopMode, setLoopMode] = useState("off");
  const [loopCount, setLoopCount] = useState(2);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const isRunning = useMemo(
    () =>
      tasks.some((t) => {
        const s = normalizeStatus(t.status);
        return s === "executing" || s === "running";
      }),
    [tasks]
  );

  const stepInfo = useMemo(() => {
    if (!selectedTask) return null;

    const stepsArr = Array.isArray(selectedTask.steps) ? selectedTask.steps : [];
    const totalFromArr = stepsArr.length;

    const totalSteps = safeNumber(
      selectedTask.totalSteps,
      totalFromArr > 0 ? totalFromArr : 0
    );

    const idx0 = safeNumber(selectedTask.currentStepIndex, 0);
    const idx1 =
      totalSteps > 0 ? Math.min(totalSteps, Math.max(1, idx0 + 1)) : 0;

    const currentStep =
      selectedTask.currentStep ||
      (totalFromArr > 0 ? stepsArr[Math.min(idx0, totalFromArr - 1)] : null);

    return {
      hasSteps: totalSteps > 0 || totalFromArr > 0,
      idx0,
      idx1,
      total: totalSteps || totalFromArr || 0,
      currentStep,
      currentStepLabel:
        currentStep?.action === "move"
          ? `move → ${getPointDisplayName(currentStep?.pointId, points)}`
          : formatStep(currentStep),
    };
  }, [selectedTask, points]);

  async function loadPoints() {
    if (!robotNgsiId) return;

    try {
      setLoadingPoints(true);
      setPointsError(null);

      const pts = await listPointsFromOrion(orionConfig, {
        robotId: robotNgsiId,
        limit: 200,
      });

      setPoints(pts);

      if (!pickPointId) {
        const defPick =
          pts.find((p) => p.id === "Point:PICK_A") ||
          pts.find((p) => p.id === "Point:HOME") ||
          pts[0];
        if (defPick?.id) setPickPointId(defPick.id);
      }

      if (!placePointId) {
        const defPlace =
          pts.find((p) => p.id === "Point:PLACE_B") ||
          pts.find((p) => p.id === "Point:SAFE") ||
          pts[0];
        if (defPlace?.id) setPlacePointId(defPlace.id);
      }

      setSteps((prev) => {
        if (prev.length > 0) return prev;

        const home = pts.find((p) => p.id === "Point:HOME")?.id || "";
        const pick = pts.find((p) => p.id === "Point:PICK_A")?.id || "";
        const place = pts.find((p) => p.id === "Point:PLACE_B")?.id || "";

        const init = [];
        if (home) init.push(makeMoveStep(home));
        if (pick) init.push(makeMoveStep(pick));
        if (place) init.push(makeMoveStep(place));
        if (home) init.push(makeMoveStep(home));

        if (init.length > 0) return init;
        if (pick && place) return [makeMoveStep(pick), makeMoveStep(place)];
        if (home) return [makeMoveStep(home)];
        return [];
      });
    } catch (e) {
      setPointsError(e?.message || "Failed to load points");
    } finally {
      setLoadingPoints(false);
    }
  }

  async function loadProcesses() {
    if (!robotNgsiId) return;

    try {
      setLoadingProcesses(true);
      setProcessesError(null);

      const defs = await listProcessDefinitionsFromOrion(orionConfig, {
        robotId: robotNgsiId,
        limit: 200,
      });

      const sorted = [...defs].sort((a, b) => {
        const aa = String(a?.updatedAt || a?.createdAt || "");
        const bb = String(b?.updatedAt || b?.createdAt || "");
        if (aa && bb) return bb.localeCompare(aa);
        return String(a?.label || "").localeCompare(String(b?.label || ""));
      });

      setSavedProcesses(sorted);
    } catch (e) {
      setProcessesError(e?.message || "Failed to load saved processes");
    } finally {
      setLoadingProcesses(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWithGuard() {
      if (!robotNgsiId) return;
      try {
        setLoadingPoints(true);
        setPointsError(null);

        const pts = await listPointsFromOrion(orionConfig, {
          robotId: robotNgsiId,
          limit: 200,
        });

        if (cancelled) return;

        setPoints(pts);

        if (!pickPointId) {
          const defPick =
            pts.find((p) => p.id === "Point:PICK_A") ||
            pts.find((p) => p.id === "Point:HOME") ||
            pts[0];
          if (defPick?.id) setPickPointId(defPick.id);
        }

        if (!placePointId) {
          const defPlace =
            pts.find((p) => p.id === "Point:PLACE_B") ||
            pts.find((p) => p.id === "Point:SAFE") ||
            pts[0];
          if (defPlace?.id) setPlacePointId(defPlace.id);
        }

        setSteps((prev) => {
          if (prev.length > 0) return prev;

          const home = pts.find((p) => p.id === "Point:HOME")?.id || "";
          const pick = pts.find((p) => p.id === "Point:PICK_A")?.id || "";
          const place = pts.find((p) => p.id === "Point:PLACE_B")?.id || "";

          const init = [];
          if (home) init.push(makeMoveStep(home));
          if (pick) init.push(makeMoveStep(pick));
          if (place) init.push(makeMoveStep(place));
          if (home) init.push(makeMoveStep(home));

          if (init.length > 0) return init;
          if (pick && place) return [makeMoveStep(pick), makeMoveStep(place)];
          if (home) return [makeMoveStep(home)];
          return [];
        });
      } catch (e) {
        if (!cancelled) setPointsError(e?.message || "Failed to load points");
      } finally {
        if (!cancelled) setLoadingPoints(false);
      }
    }

    loadWithGuard();

    return () => {
      cancelled = true;
    };
  }, [orionConfig, robotNgsiId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWithGuard() {
      if (!robotNgsiId) return;

      try {
        setLoadingProcesses(true);
        setProcessesError(null);

        const defs = await listProcessDefinitionsFromOrion(orionConfig, {
          robotId: robotNgsiId,
          limit: 200,
        });

        if (cancelled) return;

        const sorted = [...defs].sort((a, b) => {
          const aa = String(a?.updatedAt || a?.createdAt || "");
          const bb = String(b?.updatedAt || b?.createdAt || "");
          if (aa && bb) return bb.localeCompare(aa);
          return String(a?.label || "").localeCompare(String(b?.label || ""));
        });

        setSavedProcesses(sorted);
      } catch (e) {
        if (!cancelled) {
          setProcessesError(e?.message || "Failed to load saved processes");
        }
      } finally {
        if (!cancelled) {
          setLoadingProcesses(false);
        }
      }
    }

    loadWithGuard();

    return () => {
      cancelled = true;
    };
  }, [orionConfig, robotNgsiId]);

  useEffect(() => {
    let timer = null;
    let cancelled = false;

    async function loadOnce() {
      if (!robotNgsiId) return;

      try {
        setLoadingTasks((prev) => (tasks.length === 0 ? true : prev));
        setTaskError(null);

        const all = await listTasksFromOrion(orionConfig, { limit: 50 });

        const filtered = all
          .filter((t) => !robotNgsiId || t.robotId === robotNgsiId)
          .sort((a, b) => {
            const aa = String(getTaskCreatedAt(a));
            const bb = String(getTaskCreatedAt(b));
            if (aa && bb) return bb.localeCompare(aa);
            return String(b.id || "").localeCompare(String(a.id || ""));
          });

        if (cancelled) return;

        setTasks(filtered);
        setLoadingTasks(false);

        if (!selectedTaskId && filtered[0]?.id) setSelectedTaskId(filtered[0].id);

        if (selectedTaskId && !filtered.some((t) => t.id === selectedTaskId)) {
          setSelectedTaskId(filtered[0]?.id || null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadingTasks(false);
          setTaskError(e?.message || "Failed to load tasks");
        }
      }
    }

    loadOnce();

    const now = Date.now();
    const shouldFastPoll = isRunning || now < fastPollUntil;
    timer = setInterval(loadOnce, shouldFastPoll ? 1000 : 4000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [
    orionConfig,
    robotNgsiId,
    isRunning,
    selectedTaskId,
    fastPollUntil,
    tasksRefreshToken,
  ]);

  const headerStatus = isRunning ? "Running" : "Idle";

  async function onExecuteSelected() {
    if (!selectedTask?.id) return;
    try {
      setBusyExecute(true);
      await executeTask(selectedTask.id);
      setTasksRefreshToken((v) => v + 1);
      setFastPollUntil(Date.now() + 10_000);
    } catch (e) {
      alert(e?.message || "Execute failed");
    } finally {
      setBusyExecute(false);
    }
  }

  function addStep(afterIdx = null) {
    const fallbackPoint =
      points.find((p) => p.id === "Point:HOME")?.id || points[0]?.id || "";
    const newStep = makeStep("move", { pointId: fallbackPoint });

    setSteps((prev) => {
      const next = [...prev];
      if (afterIdx === null || afterIdx < 0 || afterIdx >= next.length) {
        next.push(newStep);
      } else {
        next.splice(afterIdx + 1, 0, newStep);
      }
      return next;
    });
  }

  function removeStep(idx) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveStep(idx, dir) {
    setSteps((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function setStepPoint(idx, pointId) {
    setSteps((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], pointId };
      return next;
    });
  }

  function setStepAction(idx, action) {
    setSteps((prev) => {
      const next = [...prev];
      const fallbackPoint =
        points.find((p) => p.id === "Point:HOME")?.id || points[0]?.id || "";

      if (action === "move") {
        next[idx] = makeStep("move", { pointId: fallbackPoint });
      } else if (action === "grip") {
        next[idx] = makeStep("grip");
      } else if (action === "release") {
        next[idx] = makeStep("release");
      } else if (action === "sleep") {
        next[idx] = makeStep("sleep", { seconds: 1 });
      }

      return next;
    });
  }

  function setStepSeconds(idx, seconds) {
    setSteps((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], seconds: Number(seconds) };
      return next;
    });
  }

  async function saveCurrentProcess() {
    const cleaned = steps.filter(isValidStep);

    if (!robotNgsiId) {
      alert("No robot mapping available.");
      return;
    }

    if (!processName.trim()) {
      alert("Process name is required.");
      return;
    }

    if (cleaned.length === 0) {
      alert("Add at least one valid step before saving.");
      return;
    }

    try {
      setBusySaveProcess(true);

      const payload = {
        label: processName.trim(),
        robotId: robotNgsiId,
        processId: processId || "Process:custom-01",
        steps: cloneSteps(cleaned),
        loopMode,
        loopCount: safeNumber(loopCount, 2),
        source: "frontend",
      };

      const saved = await createProcessDefinitionInOrion(orionConfig, payload);

      await loadProcesses();

      if (saved?.id) {
        setSelectedSavedProcessId(saved.id);
      }
    } catch (e) {
      alert(e?.message || "Failed to save process");
    } finally {
      setBusySaveProcess(false);
    }
  }

  function loadSavedProcess() {
    const entry = savedProcesses.find((p) => p.id === selectedSavedProcessId);
    if (!entry) {
      alert("Select a saved process.");
      return;
    }

    setProcessName(entry.label || entry.name || "");
    setProcessId(entry.processId || "Process:custom-01");
    setSteps(cloneSteps(entry.steps || []));
    setLoopMode(entry.loopMode || "off");
    setLoopCount(safeNumber(entry.loopCount, 2));
  }

  async function deleteSavedProcess() {
    if (!selectedSavedProcessId) {
      alert("Select a saved process.");
      return;
    }

    const entry = savedProcesses.find((p) => p.id === selectedSavedProcessId);
    const ok = window.confirm(
      `Delete saved process "${entry?.label || entry?.name || selectedSavedProcessId}"?`
    );
    if (!ok) return;

    try {
      setBusyDeleteProcessId(selectedSavedProcessId);
      await deleteProcessDefinitionFromOrion(selectedSavedProcessId, orionConfig);
      await loadProcesses();
      setSelectedSavedProcessId("");
    } catch (e) {
      alert(e?.message || "Failed to delete process");
    } finally {
      setBusyDeleteProcessId(null);
    }
  }

  async function onCreateTaskRequest() {
    if (!robotNgsiId) {
      alert("No robot mapping available.");
      return;
    }

    try {
      setBusyCreate(true);

      if (createMode === "simple") {
        if (!pickPointId || !placePointId) {
          alert("Select both Pick and Place points.");
          return;
        }
        if (pickPointId === placePointId) {
          alert("Pick and Place must be different.");
          return;
        }

        await createTaskRequestInOrion(orionConfig, {
          robotId: robotNgsiId,
          processId: "Process:pickplace-01",
          pickPointId,
          placePointId,
        });
      } else {
        const cleaned = steps.filter(isValidStep);
        if (cleaned.length === 0) {
          alert("Add at least one valid step.");
          return;
        }

        let finalSteps = cloneSteps(cleaned);

        if (loopMode === "count") {
          finalSteps = expandStepsByCount(finalSteps, loopCount);
        }

        const moveSteps = finalSteps.filter((s) => s.action === "move");

        const payload = {
          robotId: robotNgsiId,
          processId: processId || "Process:custom-01",
          steps: finalSteps,
          pickPointId: moveSteps?.[0]?.pointId || pickPointId || "",
          placePointId:
            moveSteps?.[1]?.pointId ||
            moveSteps?.[moveSteps.length - 1]?.pointId ||
            placePointId ||
            "",
        };

        if (loopMode === "infinite") {
          payload.loop = {
            enabled: true,
            mode: "infinite",
          };
        }

        await createTaskRequestInOrion(orionConfig, payload);
      }

      setTasksRefreshToken((v) => v + 1);
      setFastPollUntil(Date.now() + 10_000);
    } catch (e) {
      alert(e?.message || "Failed to create TaskRequest");
    } finally {
      setBusyCreate(false);
    }
  }

  async function handleRemoveTask(taskId) {
    const t = tasks.find((x) => x.id === taskId);
    const st = normalizeStatus(t?.status);

    if (st === "executing" || st === "running") {
      alert("This task is currently executing. Wait until it finishes.");
      return;
    }

    const ok = window.confirm("Remove this Task entity from Orion?");
    if (!ok) return;

    try {
      setRemovingId(taskId);
      await deleteTaskFromOrion(taskId, orionConfig);

      setTasks((prev) => prev.filter((x) => x.id !== taskId));
      setSelectedTaskId((prev) => {
        if (prev !== taskId) return prev;
        const remaining = tasks.filter((x) => x.id !== taskId);
        return remaining[0]?.id || null;
      });
    } catch (e) {
      alert(e?.message || "Failed to remove task");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRemovePoint(point) {
    if (!point?.id) return;

    const ok = window.confirm(
      `Remove point "${point.label || point.id}" from Orion?`
    );
    if (!ok) return;

    try {
      setRemovingPointId(point.id);
      await deletePointViaOrchestrator(point.id);

      setPoints((prev) => prev.filter((p) => p.id !== point.id));

      if (pickPointId === point.id) setPickPointId("");
      if (placePointId === point.id) setPlacePointId("");

      setSteps((prev) =>
        prev.map((step) =>
          step?.action === "move" && step?.pointId === point.id
            ? { ...step, pointId: "" }
            : step
        )
      );
    } catch (e) {
      alert(e?.message || "Failed to remove point");
    } finally {
      setRemovingPointId(null);
    }
  }

  function handleOpenCamera() {
    if (!CAMERA_URL) {
      alert("Camera URL not configured. Set VITE_CAMERA_URL.");
      return;
    }
    window.open(CAMERA_URL, "_blank", "noopener,noreferrer");
  }

  const canExecuteSelected = useMemo(() => {
    const st = normalizeStatus(selectedTask?.status);
    return st === "queued" || st === "created";
  }, [selectedTask]);

  const createDisabled =
    busyCreate || loadingPoints || points.length === 0 || !robotNgsiId;

  return (
    <div style={ui.appShell}>
      <div style={ui.headerRow}>
        <div style={ui.brand}>
          <span style={ui.logoDot} />
          <div>
            <div style={ui.title}>Robotic Arm – Digital Twin Dashboard</div>
            <div style={ui.subtle}>
              Context-driven orchestration (Orion) · Execution via Orchestrator
            </div>
          </div>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={ui.pill("neutral")}>
            <span style={{ color: "#64748b" }}>Robot</span>
            <span style={{ fontWeight: 950 }}>{machineId}</span>
          </div>

          <div style={ui.pill(headerStatus === "Running" ? "running" : "idle")}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background:
                  headerStatus === "Running" ? "#f59e0b" : "#64748b",
                boxShadow:
                  headerStatus === "Running"
                    ? "0 0 0 5px rgba(245,158,11,0.18)"
                    : "0 0 0 5px rgba(100,116,139,0.14)",
              }}
            />
            <span>{headerStatus}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowPointsModal(true)}
            style={ui.topActionBtn}
          >
            Points ({points.length})
          </button>

          <button
            type="button"
            onClick={handleOpenCamera}
            style={ui.topActionBtn}
          >
            Camera
          </button>

          <button onClick={onClose} style={ui.closeBtn}>
            Close
          </button>
        </div>
      </div>

      <div style={ui.grid}>
        <div style={{ ...ui.panel, minHeight: 0 }}>
          <div style={ui.panelHeaderRow}>
            <div style={ui.panelTitle}>Tasks</div>
            <div style={{ marginLeft: "auto", ...ui.subtle }}>
              {robotNgsiId ? robotNgsiId : "No robot mapping"}
            </div>
          </div>

          <div style={{ ...ui.card, maxHeight: "52vh", overflowY: "auto" }}>
            <div style={ui.cardHeader}>
              <div>
                <div style={ui.cardTitle}>Create TaskRequest</div>
                <div style={{ ...ui.subtle, marginTop: 2 }}>
                  Simple = pick/place · Advanced = explicit steps
                </div>
              </div>

              <div style={ui.segmented}>
                <button
                  type="button"
                  onClick={() => setCreateMode("simple")}
                  style={ui.segBtn(createMode === "simple")}
                >
                  Simple
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("advanced")}
                  style={ui.segBtn(createMode === "advanced")}
                >
                  Advanced
                </button>
              </div>
            </div>

            {pointsError && (
              <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>
                {pointsError}
              </div>
            )}

            {processesError && (
              <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>
                {processesError}
              </div>
            )}

            {createMode === "simple" && (
              <div style={{ display: "grid", gap: 10 }}>
                <label style={ui.label}>
                  Pick point
                  <select
                    value={pickPointId}
                    onChange={(e) => setPickPointId(e.target.value)}
                    disabled={loadingPoints || points.length === 0}
                    style={ui.select}
                  >
                    {points.length === 0 ? (
                      <option value="">
                        {loadingPoints ? "Loading..." : "No points found"}
                      </option>
                    ) : (
                      points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label || p.id}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label style={ui.label}>
                  Place point
                  <select
                    value={placePointId}
                    onChange={(e) => setPlacePointId(e.target.value)}
                    disabled={loadingPoints || points.length === 0}
                    style={ui.select}
                  >
                    {points.length === 0 ? (
                      <option value="">
                        {loadingPoints ? "Loading..." : "No points found"}
                      </option>
                    ) : (
                      points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label || p.id}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>
            )}

            {createMode === "advanced" && (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={ui.label}>
                    Saved process
                    <select
                      value={selectedSavedProcessId}
                      onChange={(e) => setSelectedSavedProcessId(e.target.value)}
                      style={ui.select}
                      disabled={loadingProcesses}
                    >
                      <option value="">
                        {loadingProcesses ? "Loading processes..." : "Select saved process"}
                      </option>
                      {savedProcesses.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label || p.name || p.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={loadSavedProcess}
                      style={ui.ghostBtn(!selectedSavedProcessId)}
                      disabled={!selectedSavedProcessId}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={deleteSavedProcess}
                      style={ui.ghostBtn(
                        !selectedSavedProcessId ||
                          busyDeleteProcessId === selectedSavedProcessId
                      )}
                      disabled={
                        !selectedSavedProcessId ||
                        busyDeleteProcessId === selectedSavedProcessId
                      }
                    >
                      {busyDeleteProcessId === selectedSavedProcessId
                        ? "Deleting…"
                        : "Delete"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={ui.label}>
                    Process name
                    <input
                      value={processName}
                      onChange={(e) => setProcessName(e.target.value)}
                      placeholder="Pick A to Place B"
                      style={ui.input}
                    />
                  </label>

                  <label style={ui.label}>
                    Process ID
                    <input
                      value={processId}
                      onChange={(e) => setProcessId(e.target.value)}
                      placeholder="Process:custom-01"
                      style={ui.input}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={saveCurrentProcess}
                      style={ui.ghostBtn(busySaveProcess)}
                      disabled={busySaveProcess}
                    >
                      {busySaveProcess ? "Saving…" : "Save process"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProcessName("");
                        setProcessId("Process:custom-01");
                        setSteps([]);
                        setLoopMode("off");
                        setLoopCount(2);
                        setSelectedSavedProcessId("");
                      }}
                      style={ui.ghostBtn(false)}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 950, fontSize: 13, color: "#0f172a" }}>
                    Loop
                  </div>

                  <div style={ui.chipsRow}>
                    <button
                      type="button"
                      onClick={() => setLoopMode("off")}
                      style={ui.chip(loopMode === "off")}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoopMode("count")}
                      style={ui.chip(loopMode === "count")}
                    >
                      Count
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoopMode("infinite")}
                      style={ui.chip(loopMode === "infinite")}
                    >
                      Infinite
                    </button>
                  </div>

                  {loopMode === "count" && (
                    <label style={ui.label}>
                      Repeat count
                      <input
                        type="number"
                        min="2"
                        max="100"
                        step="1"
                        value={loopCount}
                        onChange={(e) => setLoopCount(e.target.value)}
                        style={ui.input}
                      />
                    </label>
                  )}

                  {loopMode === "infinite" && (
                    <div style={{ ...ui.subtle, lineHeight: 1.35 }}>
                      Infinite loop is sent as metadata in the TaskRequest.
                      The orchestrator/backend must support it.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 950, fontSize: 13, color: "#0f172a" }}>
                    Steps
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <button
                      type="button"
                      onClick={() => addStep(null)}
                      style={ui.ghostBtn(false)}
                    >
                      + Add step
                    </button>
                  </div>
                </div>

                <div style={ui.stepList}>
                  {steps.length === 0 ? (
                    <div style={{ padding: 12, ...ui.subtle }}>
                      No steps yet. Add move, grip, release or sleep.
                    </div>
                  ) : (
                    steps.map((st, idx) => (
                      <div
                        key={`${idx}-${st.action || "x"}-${st.pointId || "nopoint"}`}
                        style={{
                          ...ui.stepRow,
                          borderBottom:
                            idx === steps.length - 1
                              ? "none"
                              : "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        <div style={ui.stepIndex}>{idx + 1}</div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "86px 1fr",
                            gap: 8,
                          }}
                        >
                          <select
                            value={st.action || "move"}
                            onChange={(e) => setStepAction(idx, e.target.value)}
                            style={ui.select}
                          >
                            <option value="move">move</option>
                            <option value="grip">grip</option>
                            <option value="release">release</option>
                            <option value="sleep">sleep</option>
                          </select>

                          {st.action === "move" && (
                            <select
                              value={st.pointId || ""}
                              onChange={(e) => setStepPoint(idx, e.target.value)}
                              disabled={loadingPoints || points.length === 0}
                              style={ui.select}
                            >
                              {points.length === 0 ? (
                                <option value="">
                                  {loadingPoints ? "Loading..." : "No points found"}
                                </option>
                              ) : (
                                points.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label || p.id}
                                  </option>
                                ))
                              )}
                            </select>
                          )}

                          {st.action === "sleep" && (
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={st.seconds ?? 1}
                              onChange={(e) => setStepSeconds(idx, e.target.value)}
                              style={ui.input}
                              placeholder="Seconds"
                            />
                          )}

                          {(st.action === "grip" || st.action === "release") && (
                            <div
                              style={{
                                ...ui.input,
                                display: "flex",
                                alignItems: "center",
                                color: "#64748b",
                                background: "rgba(15,23,42,0.03)",
                              }}
                            >
                              Uses backend defaults
                            </div>
                          )}
                        </div>

                        <div style={ui.stepActions}>
                          <button
                            type="button"
                            onClick={() => moveStep(idx, -1)}
                            disabled={idx === 0}
                            style={ui.iconBtn(false, idx === 0)}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(idx, +1)}
                            disabled={idx === steps.length - 1}
                            style={ui.iconBtn(false, idx === steps.length - 1)}
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(idx)}
                            style={ui.iconBtn(true, false)}
                            title="Remove step"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ ...ui.subtle, lineHeight: 1.35 }}>
                  The <strong>steps[]</strong> list is the source of truth.
                  Saved processes are now persisted in Orion as reusable process definitions.
                </div>
              </div>
            )}

            <div style={ui.divider} />

            <button
              type="button"
              onClick={onCreateTaskRequest}
              disabled={createDisabled}
              style={ui.primaryBtn(createDisabled)}
            >
              {busyCreate ? "Creating…" : "Create TaskRequest"}
            </button>
          </div>

          {taskError && (
            <div style={{ fontSize: 13, color: "#dc2626", marginTop: 12 }}>
              {taskError}
            </div>
          )}

          <div style={ui.tasksScroll}>
            {loadingTasks && <div style={ui.loadingOverlay}>Loading tasks…</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tasks.map((t) => {
                const active = t.id === selectedTaskId;
                const hasSteps = Array.isArray(t.steps) && t.steps.length > 0;

                const firstStep = t.steps?.[0];
                const lastStep = t.steps?.[t.steps.length - 1];

                const firstStepLabel = hasSteps
                  ? formatStepWithPoints(firstStep, points)
                  : "";

                const lastStepLabel = hasSteps
                  ? formatStepWithPoints(lastStep, points)
                  : "";

                const label = hasSteps
                  ? firstStepLabel +
                    (t.steps.length > 1 ? ` → ${lastStepLabel}` : "")
                  : `${getPointDisplayName(
                      t.pickPointId,
                      points
                    )} → ${getPointDisplayName(t.placePointId, points)}`;

                const progress = getTaskProgressPct(t);
                const isRemoving = removingId === t.id;

                const totalSteps = safeNumber(
                  t.totalSteps,
                  hasSteps ? t.steps.length : 0
                );
                const currentIdx1 =
                  totalSteps > 0 ? safeNumber(t.currentStepIndex, 0) + 1 : 0;

                const st = normalizeStatus(t.status);

                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTaskId(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedTaskId(t.id);
                      }
                    }}
                    style={ui.taskItem(active)}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: statusColor(st),
                          display: "inline-block",
                          boxShadow: `0 0 0 5px ${statusColor(st)}22`,
                        }}
                      />
                      <div style={{ fontWeight: 950, fontSize: 13, color: "#0f172a" }}>
                        {label}
                      </div>

                      <div
                        style={{
                          marginLeft: "auto",
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div style={ui.subtle}>{st || "—"}</div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTask(t.id);
                          }}
                          disabled={isRemoving || st === "executing" || st === "running"}
                          style={{
                            ...ui.ghostBtn(
                              isRemoving || st === "executing" || st === "running"
                            ),
                            color: "#dc2626",
                          }}
                          title={
                            st === "executing" || st === "running"
                              ? "Cannot remove while executing"
                              : "Remove task from Orion"
                          }
                        >
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>

                    {active && totalSteps > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#334155" }}>
                        <span style={{ color: "#64748b" }}>Step:</span>{" "}
                        <strong>
                          {Math.min(totalSteps, Math.max(1, currentIdx1))}/{totalSteps}
                        </strong>
                        <span style={{ color: "#64748b" }}> · </span>
                        <span>
                          {(() => {
                            const activeStep =
                              t.currentStep ||
                              (hasSteps
                                ? t.steps[safeNumber(t.currentStepIndex, 0)]
                                : null);

                            return formatStepWithPoints(activeStep, points);
                          })()}
                        </span>
                      </div>
                    )}

                    <div style={{ marginTop: 10 }}>
                      <div style={ui.progressTrack}>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 999,
                            width: `${progress}%`,
                            background: statusColor(st),
                            transition: "width 250ms ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {!loadingTasks && tasks.length === 0 && (
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  No tasks found for this robot.
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, flexShrink: 0 }}>
            <button
              onClick={onExecuteSelected}
              disabled={!selectedTask || !canExecuteSelected || busyExecute}
              style={ui.execCta(!!selectedTask && canExecuteSelected && !busyExecute)}
              title={
                canExecuteSelected
                  ? "Start execution"
                  : "Only queued/created tasks can be executed"
              }
            >
              {busyExecute ? "Starting…" : "Execute"}
            </button>
          </div>
        </div>

        <div style={{ ...ui.panel, minHeight: 0 }}>
          <div style={ui.sectionTitle}>Execution View</div>

          <div style={ui.heroFrame}>
            <iframe
              src={UNITY_URL}
              title="Unity Digital Twin"
              style={ui.unityFrame}
              allow="fullscreen"
            />
          </div>
        </div>

        <div style={{ ...ui.panel, minHeight: 0, overflowY: "auto" }}>
          <div style={ui.sectionTitle}>Robot Status</div>

          <div style={ui.kv}>
            <div>
              <span style={ui.k}>Mode:</span>{" "}
              <strong>{selectedTask?.executor || "—"}</strong>
            </div>

            <div>
              <span style={ui.k}>Current process:</span>{" "}
              <strong>{selectedTask?.processId || "—"}</strong>
            </div>

            <div>
              <span style={ui.k}>Status:</span>{" "}
              <strong>{normalizeStatus(selectedTask?.status) || "—"}</strong>
            </div>

            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: 8 }}>Current Step</div>

              {!selectedTask ? (
                <div style={{ color: "#64748b" }}>—</div>
              ) : stepInfo?.hasSteps ? (
                <>
                  <div>
                    <span style={ui.k}>Step:</span>{" "}
                    <strong>
                      {stepInfo.idx1}/{stepInfo.total}
                    </strong>
                  </div>
                  <div>
                    <span style={ui.k}>Action:</span>{" "}
                    <strong>{stepInfo.currentStep?.action || "move"}</strong>
                  </div>
                  <div>
                    <span style={ui.k}>Target:</span>{" "}
                    <strong>
                      {stepInfo.currentStep?.action === "move"
                        ? getPointDisplayName(stepInfo.currentStep?.pointId, points)
                        : stepInfo.currentStep?.action === "sleep"
                        ? `${stepInfo.currentStep?.seconds ?? 1}s`
                        : "Uses backend defaults"}
                    </strong>
                  </div>
                </>
              ) : (
                <div style={{ color: "#64748b" }}>
                  This task has no steps (legacy mode).
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={ui.sectionTitle}>Metrics</div>

            <div style={ui.kv}>
              <div>
                <span style={ui.k}>Execution time:</span>{" "}
                <strong>
                  {selectedTask?.durationMs
                    ? `${(selectedTask.durationMs / 1000).toFixed(2)} s`
                    : "—"}
                </strong>
              </div>

              <div>
                <span style={ui.k}>Completed tasks:</span>{" "}
                <strong>
                  {
                    tasks.filter((t) => {
                      const st = normalizeStatus(t.status);
                      return st === "completed" || st === "done";
                    }).length
                  }
                </strong>
              </div>

              <div>
                <span style={ui.k}>Progress:</span>{" "}
                <strong>
                  {selectedTask ? `${getTaskProgressPct(selectedTask)}%` : "—"}
                </strong>
              </div>

              <div>
                <span style={ui.k}>Points loaded:</span>{" "}
                <strong>{points.length}</strong>
              </div>

              <div>
                <span style={ui.k}>Processes loaded:</span>{" "}
                <strong>{savedProcesses.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PointsModal
        open={showPointsModal}
        onClose={() => setShowPointsModal(false)}
        points={points}
        loadingPoints={loadingPoints}
        pointsError={pointsError}
        onRefresh={loadPoints}
        onRemove={handleRemovePoint}
        removingPointId={removingPointId}
        robotNgsiId={robotNgsiId}
      />
    </div>
  );
}