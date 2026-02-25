import React, { useEffect, useMemo, useState } from "react";
import {
  listTasksFromOrion,
  deleteTaskFromOrion,
} from "../services/orionClientTasks";
import { listPointsFromOrion } from "../services/orionClientPoints";
import { createTaskRequestInOrion } from "../services/orionClientTaskRequests";

const ORCHESTRATOR_URL =
  import.meta.env?.VITE_ORCHESTRATOR_URL || "http://localhost:3005";

function statusColor(status) {
  if (status === "executing") return "#f59e0b";
  if (status === "completed") return "#16a34a";
  if (status === "failed") return "#dc2626";
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

  // ✅ Points + create TaskRequest
  const [points, setPoints] = useState([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointsError, setPointsError] = useState(null);
  const [pickPointId, setPickPointId] = useState("");
  const [placePointId, setPlacePointId] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);

  // ✅ NEW: help Orion eventual consistency feel instant
  const [fastPollUntil, setFastPollUntil] = useState(0);
  const [tasksRefreshToken, setTasksRefreshToken] = useState(0);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const isRunning = useMemo(
    () => tasks.some((t) => t.status === "executing"),
    [tasks]
  );

  // ✅ load points for dropdowns
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

        // sensible defaults
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

  // ✅ fetch tasks + polling (fast when executing OR right after creation)
  useEffect(() => {
    let timer = null;
    let cancelled = false;

    async function loadOnce() {
      if (!robotNgsiId) return;

      try {
        // show overlay only on first load (avoid UI "jump" during polling)
        setLoadingTasks((prev) => (tasks.length === 0 ? true : prev));
        setTaskError(null);

        const all = await listTasksFromOrion(orionConfig, { limit: 30 });

        const filtered = all
          .filter((t) => !robotNgsiId || t.robotId === robotNgsiId)
          .sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          );

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
    const intervalMs = shouldFastPoll ? 1000 : 4000;

    timer = setInterval(loadOnce, intervalMs);

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
    } catch (e) {
      alert(e?.message || "Execute failed");
    } finally {
      setBusyExecute(false);
    }
  }

  async function onCreateTaskRequest() {
    if (!robotNgsiId) {
      alert("No robot mapping available.");
      return;
    }
    if (!pickPointId || !placePointId) {
      alert("Select both Pick and Place points.");
      return;
    }
    if (pickPointId === placePointId) {
      alert("Pick and Place must be different.");
      return;
    }

    try {
      setBusyCreate(true);

      await createTaskRequestInOrion(orionConfig, {
        robotId: robotNgsiId,
        processId: "Process:pickplace-01",
        pickPointId,
        placePointId,
      });

      // ✅ feels instant: refresh now + poll faster for a few seconds
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

    if (t?.status === "executing") {
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

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 18px 60px rgba(15, 23, 42, 0.18)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          Robotic Arm – Digital Twin Dashboard
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, color: "#334155" }}>
            Robot: <strong>{machineId}</strong>{" "}
            <span
              style={{
                marginLeft: 8,
                color: headerStatus === "Running" ? "#f59e0b" : "#64748b",
              }}
            >
              ● {headerStatus}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#fff",
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 280px",
          gap: 12,
          height: "70vh",
          alignItems: "stretch",
        }}
      >
        {/* LEFT: Tasks */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            padding: 12,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 10 }}
          >
            <div style={{ fontWeight: 800 }}>Tasks</div>
            <div
              style={{
                marginLeft: "auto",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              {robotNgsiId ? robotNgsiId : "No robot mapping"}
            </div>
          </div>

          {/* Create TaskRequest */}
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              padding: 10,
              background: "rgba(15,23,42,0.02)",
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
              Create Pick &amp; Place
            </div>

            {pointsError && (
              <div
                style={{
                  fontSize: 12,
                  color: "#dc2626",
                  marginBottom: 6,
                }}
              >
                {pointsError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              <label style={{ fontSize: 12, color: "#64748b" }}>
                Pick point
                <select
                  value={pickPointId}
                  onChange={(e) => setPickPointId(e.target.value)}
                  disabled={loadingPoints || points.length === 0}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "white",
                  }}
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

              <label style={{ fontSize: 12, color: "#64748b" }}>
                Place point
                <select
                  value={placePointId}
                  onChange={(e) => setPlacePointId(e.target.value)}
                  disabled={loadingPoints || points.length === 0}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "white",
                  }}
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

              <button
                type="button"
                onClick={onCreateTaskRequest}
                disabled={
                  busyCreate ||
                  loadingPoints ||
                  points.length === 0 ||
                  !robotNgsiId
                }
                style={{
                  width: "100%",
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#3b82f6",
                  color: "white",
                  cursor: busyCreate ? "wait" : "pointer",
                  fontWeight: 800,
                  opacity:
                    busyCreate ||
                    loadingPoints ||
                    points.length === 0 ||
                    !robotNgsiId
                      ? 0.7
                      : 1,
                }}
              >
                {busyCreate ? "Creating…" : "Create TaskRequest"}
              </button>
            </div>

            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
              Creates a <strong>TaskRequest</strong> (pending). Orchestrator will
              accept and create a Task.
            </div>
          </div>

          {taskError && (
            <div style={{ fontSize: 13, color: "#dc2626", marginTop: 6 }}>
              {taskError}
            </div>
          )}

          {/* Scrollable list + loading overlay */}
          <div
            style={{
              position: "relative",
              marginTop: 10,
              flex: 1,
              overflow: "auto",
              paddingRight: 4,
            }}
          >
            {loadingTasks && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(255,255,255,0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  color: "#475569",
                  zIndex: 2,
                  borderRadius: 12,
                  pointerEvents: "none",
                }}
              >
                Loading tasks…
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.map((t) => {
                const active = t.id === selectedTaskId;
                const label = `${t.pickPointId || "?"} → ${t.placePointId || "?"}`;
                const progress = Math.max(
                  0,
                  Math.min(100, Number(t.progress || 0))
                );
                const isRemoving = removingId === t.id;

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    style={{
                      textAlign: "left",
                      borderRadius: 12,
                      padding: "10px 10px",
                      border: active
                        ? "2px solid #3b82f6"
                        : "1px solid rgba(0,0,0,0.08)",
                      background: active ? "rgba(59,130,246,0.08)" : "white",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 99,
                          background: statusColor(t.status),
                          display: "inline-block",
                        }}
                      />
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>

                      <div
                        style={{
                          marginLeft: "auto",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {t.status}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTask(t.id);
                          }}
                          disabled={isRemoving || t.status === "executing"}
                          title={
                            t.status === "executing"
                              ? "Cannot remove while executing"
                              : "Remove task from Orion"
                          }
                          style={{
                            border: "1px solid rgba(0,0,0,0.10)",
                            background: "white",
                            borderRadius: 10,
                            padding: "6px 10px",
                            cursor:
                              t.status === "executing" ? "not-allowed" : "pointer",
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#dc2626",
                            opacity: isRemoving ? 0.6 : 1,
                          }}
                        >
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 99,
                          background: "rgba(15,23,42,0.08)",
                        }}
                      >
                        <div
                          style={{
                            height: 8,
                            borderRadius: 99,
                            width: `${progress}%`,
                            background: statusColor(t.status),
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}

              {!loadingTasks && tasks.length === 0 && (
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  No tasks found for this robot.
                </div>
              )}
            </div>
          </div>

          {/* Execute (fixed at bottom) */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={onExecuteSelected}
              disabled={
                !selectedTask || selectedTask.status !== "queued" || busyExecute
              }
              style={{
                width: "100%",
                borderRadius: 12,
                padding: "10px 12px",
                border: "1px solid rgba(0,0,0,0.08)",
                background:
                  selectedTask?.status === "queued"
                    ? "#16a34a"
                    : "rgba(15,23,42,0.06)",
                color: selectedTask?.status === "queued" ? "white" : "#64748b",
                cursor:
                  selectedTask?.status === "queued" ? "pointer" : "not-allowed",
                fontWeight: 800,
              }}
              title={
                selectedTask?.status === "queued"
                  ? "Start execution"
                  : "Only queued tasks can be executed"
              }
            >
              {busyExecute ? "Starting…" : "Execute"}
            </button>
          </div>
        </div>

        {/* CENTER */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            padding: 12,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Execution View</div>

          <div
            style={{
              flex: 1,
              borderRadius: 14,
              background: "rgba(15,23,42,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: 13,
              textAlign: "center",
              padding: 24,
            }}
          >
            Placeholder for simulation/robot visualization (Unity/stream).
            <br />
            For now, the Digital Twin execution is reflected via NGSI task states
            and progress.
          </div>
        </div>

        {/* RIGHT */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            padding: 12,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Robot Status</div>

          <div
            style={{
              fontSize: 13,
              color: "#0f172a",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div>
              <span style={{ color: "#64748b" }}>Mode:</span>{" "}
              <strong>{selectedTask?.executor || "—"}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Current process:</span>{" "}
              <strong>{selectedTask?.processId || "—"}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Status:</span>{" "}
              <strong>{selectedTask?.status || "—"}</strong>
            </div>
          </div>

          <div style={{ marginTop: 16, fontWeight: 800, marginBottom: 10 }}>
            Metrics
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#0f172a",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div>
              <span style={{ color: "#64748b" }}>Execution time:</span>{" "}
              <strong>
                {selectedTask?.durationMs
                  ? `${(selectedTask.durationMs / 1000).toFixed(2)} s`
                  : "—"}
              </strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Completed tasks:</span>{" "}
              <strong>{tasks.filter((t) => t.status === "completed").length}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}