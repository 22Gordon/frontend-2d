import React, { useEffect, useMemo, useState } from "react";
import {
  listTasksFromOrion,
  deleteTaskFromOrion,
} from "../services/orionClientTasks";
import { listPointsFromOrion } from "../services/orionClientPoints";
import { createTaskRequestInOrion } from "../services/orionClientTaskRequests";

const ORCHESTRATOR_URL =
  import.meta.env?.VITE_ORCHESTRATOR_URL || "http://localhost:3005";

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
  const maybe = machineData?.robotId || machineData?.id;
  if (typeof maybe === "string" && maybe.startsWith("Robot:")) return maybe;

  if ((machineId || "").toLowerCase().includes("braco")) return "Robot:ur5e-01";
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

function getTaskProgressPct(task) {
  const v = task?.progressPct ?? task?.progress ?? 0;
  return Math.max(0, Math.min(100, safeNumber(v, 0)));
}

function getTaskCreatedAt(task) {
  return task?.createdAt || task?.requestedAt || task?.acceptedAt || "";
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
    minHeight: "100vh",
    width: "100%",
    padding: 18,
    boxSizing: "border-box",
    overflow: "auto",
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

  grid: {
    display: "grid",
    gridTemplateColumns: "380px minmax(0, 1fr) 340px",
    gap: 14,
    alignItems: "start",
    minHeight: 0,
  },

  panel: {
    borderRadius: 18,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
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
    overflowY: "auto",
    minHeight: 0,
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
    minHeight: 300,
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.03), rgba(15,23,42,0.01))",
    border: "1px solid rgba(0,0,0,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    padding: 24,
    boxSizing: "border-box",
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
};

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

  const [createMode, setCreateMode] = useState("simple");
  const [steps, setSteps] = useState([]);
  const [processId, setProcessId] = useState("Process:pickplace-01");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const [fastPollUntil, setFastPollUntil] = useState(0);
  const [tasksRefreshToken, setTasksRefreshToken] = useState(0);

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
    const idx1 = totalSteps > 0 ? Math.min(totalSteps, Math.max(1, idx0 + 1)) : 0;

    const currentStep =
      selectedTask.currentStep ||
      (totalFromArr > 0 ? stepsArr[Math.min(idx0, totalFromArr - 1)] : null);

    return {
      hasSteps: totalSteps > 0 || totalFromArr > 0,
      idx0,
      idx1,
      total: totalSteps || totalFromArr || 0,
      currentStep,
      currentStepLabel: formatStep(currentStep),
    };
  }, [selectedTask]);

  useEffect(() => {
    let cancelled = false;

    async function loadPoints() {
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

    loadPoints();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function applyPreset(preset) {
    const home = points.find((p) => p.id === "Point:HOME")?.id || "";
    const pick =
      pickPointId || points.find((p) => p.id === "Point:PICK_A")?.id || "";
    const place =
      placePointId || points.find((p) => p.id === "Point:PLACE_B")?.id || "";

    if (preset === "home") {
      if (!home) return alert("No Point:HOME found.");
      setSteps([makeMoveStep(home)]);
      setProcessId("Process:manual-01");
      return;
    }

    if (preset === "pickplace") {
      if (!pick || !place) return alert("Select Pick and Place points.");
      setSteps([
        makeMoveStep(pick),
        makeStep("grip"),
        makeMoveStep(place),
        makeStep("release"),
      ]);
      setProcessId("Process:pickplace-01");
      return;
    }

    if (preset === "home_pick_place_home") {
      if (!home) return alert("No Point:HOME found.");
      if (!pick || !place) return alert("Select Pick and Place points.");
      setSteps([
        makeMoveStep(home),
        makeMoveStep(pick),
        makeStep("grip"),
        makeMoveStep(place),
        makeStep("release"),
        makeMoveStep(home),
      ]);
      setProcessId("Process:pickplace-01");
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

        const moveSteps = cleaned.filter((s) => s.action === "move");

        await createTaskRequestInOrion(orionConfig, {
          robotId: robotNgsiId,
          processId: processId || "Process:custom-01",
          steps: cleaned,
          pickPointId: moveSteps?.[0]?.pointId || pickPointId || "",
          placePointId: moveSteps?.[1]?.pointId || moveSteps?.[moveSteps.length - 1]?.pointId || placePointId || "",
        });
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

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
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
                background: headerStatus === "Running" ? "#f59e0b" : "#64748b",
                boxShadow:
                  headerStatus === "Running"
                    ? "0 0 0 5px rgba(245,158,11,0.18)"
                    : "0 0 0 5px rgba(100,116,139,0.14)",
              }}
            />
            <span>{headerStatus}</span>
          </div>

          <button onClick={onClose} style={ui.closeBtn}>
            Close
          </button>
        </div>
      </div>

      <div style={ui.grid}>
        <div style={ui.panel}>
          <div style={ui.panelHeaderRow}>
            <div style={ui.panelTitle}>Tasks</div>
            <div style={{ marginLeft: "auto", ...ui.subtle }}>
              {robotNgsiId ? robotNgsiId : "No robot mapping"}
            </div>
          </div>

          <div style={ui.card}>
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
                <div style={ui.chipsRow}>
                  <button type="button" onClick={() => applyPreset("home")} style={ui.chip()}>
                    HOME
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("pickplace")}
                    style={ui.chip()}
                  >
                    Pick → Grip → Place → Release
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("home_pick_place_home")}
                    style={ui.chip()}
                  >
                    HOME → Pick → Grip → Place → Release → HOME
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings((v) => !v)}
                    style={ui.chip(showAdvancedSettings)}
                    title="Advanced settings"
                  >
                    ⚙ Settings
                  </button>
                </div>

                {showAdvancedSettings && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={ui.label}>
                      Process ID
                      <input
                        value={processId}
                        onChange={(e) => setProcessId(e.target.value)}
                        placeholder="Process:custom-01"
                        style={ui.input}
                      />
                    </label>
                  </div>
                )}

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

                        <div style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 8 }}>
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
                  Grip/release currently use backend defaults.
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

                const label = hasSteps
                  ? formatStep(t.steps?.[0]) +
                    (t.steps.length > 1 ? ` → ${formatStep(t.steps?.[t.steps.length - 1])}` : "")
                  : `${t.pickPointId || "?"} → ${t.placePointId || "?"}`;

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
                          {formatStep(
                            t.currentStep ||
                              (hasSteps
                                ? t.steps[safeNumber(t.currentStepIndex, 0)]
                                : null)
                          )}
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

          <div style={{ marginTop: 12 }}>
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

        <div style={ui.panel}>
          <div style={ui.sectionTitle}>Execution View</div>

          <div style={ui.heroFrame}>
            Placeholder for simulation/robot visualization (Unity/stream).
            <br />
            For now, execution is reflected via NGSI task states and progress.
          </div>
        </div>

        <div style={{ ...ui.panel, overflowY: "auto", minHeight: 0 }}>
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
                        ? stepInfo.currentStep?.pointId || "—"
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}