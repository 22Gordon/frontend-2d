import React, { useState, useEffect, useCallback } from "react";
import "./index.css";
import "./styles/ui.css";
import "./App.css";

import FactoryMap from "./components/FactoryMap";
import MachineDetails from "./components/MachineDetails";
import ZoneSelector from "./components/ZoneSelector";
import Sidebar from "./components/Sidebar";
import Spinner from "./components/Spinner";
import AddMachinePanel from "./components/AddMachinePanel";
import Modal from "./components/Modal";
import ConfirmDialog from "./components/ConfirmDialog";
import OrionSettingsPanel from "./components/OrionSettingsPanel";

import { getMachineDataFromOrion } from "./services/orionClient";
import {
  getEffectiveLayout,
  addMachineToLayout,
  setMachinePosition,
  removeMachineFromLayout,
  isOverlayMachine,
} from "./utils/layoutStore";

function App() {
  const [selectedZone, setSelectedZone] = useState("A");
  const [selectedMachine, setSelectedMachine] = useState(null);

  const [machineData, setMachineData] = useState({});
  const [reqState, setReqState] = useState({}); // { [id]: { loading, error } }

  // UI: painel Add + modos
  const [openAdd, setOpenAdd] = useState(false);
  const [placementCandidateId, setPlacementCandidateId] = useState(null);
  const [moveMode, setMoveMode] = useState(false);

  // Confirm remove
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  // Orion settings modal
  const [showOrionSettings, setShowOrionSettings] = useState(false);

  // ---- Layout em STATE (para forçar re-render na sidebar) ----
  const [layout, setLayout] = useState(() => getEffectiveLayout());
  const [layoutVersion, setLayoutVersion] = useState(0); // bump sempre que layout muda
  const zoneMachines = Object.keys(layout[selectedZone]?.machines || {});
  // ------------------------------------------------------------

  // helpers de estado de pedidos
  const setLoading = (id, loading) =>
    setReqState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        loading,
        ...(loading ? { error: null } : {}),
      },
    }));

  const setError = (id, error) =>
    setReqState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), loading: false, error },
    }));

  const fetchAndSetMachineData = useCallback(async (machineId) => {
    try {
      setLoading(machineId, true);
      const data = await getMachineDataFromOrion(machineId);
      if (data) {
        setMachineData((prev) => ({ ...prev, [machineId]: data }));
        setLoading(machineId, false);
      } else {
        setError(machineId, "No data returned");
      }
    } catch (e) {
      setError(machineId, e?.message || "Network error");
    }
  }, []);

  const handleSelectMachine = (machineId) => {
    setSelectedMachine(machineId);
    fetchAndSetMachineData(machineId);
  };

  // Polling por zona + manter layout state sincronizado
  useEffect(() => {
    function tick() {
      const layoutNow = getEffectiveLayout();
      setLayout(layoutNow);
      setLayoutVersion((v) => v + 1); // força refresh da Sidebar quando overlay muda
      const ids = Object.keys(layoutNow[selectedZone]?.machines || {});
      ids.forEach(fetchAndSetMachineData);
    }
    tick();
    const interval = setInterval(tick, 8000);
    return () => clearInterval(interval);
  }, [selectedZone, fetchAndSetMachineData]);

  const handleZoneChange = (zone) => {
    setSelectedZone(zone);
    setSelectedMachine(null);
    setMoveMode(false);
    setPlacementCandidateId(null);
    setConfirmRemoveId(null);
    setLayout(getEffectiveLayout());
    setLayoutVersion((v) => v + 1);
  };

  const zoneErrors = zoneMachines.filter((id) => reqState[id]?.error);

  function handleEnterPlaceMode(id) {
    setPlacementCandidateId(id);
    setMoveMode(false);
    setOpenAdd(false);
  }

  // place -> cria e já faz fetch para pintar estado
  function handlePlace({ id, x, y, zone }) {
    addMachineToLayout({ zone, id, x, y, status: "inactive" });
    setLayout(getEffectiveLayout()); // atualiza sidebar imediatamente
    setLayoutVersion((v) => v + 1);
    setPlacementCandidateId(null);
    fetchAndSetMachineData(id);
  }

  function handleRelocate({ id, x, y, zone }) {
    setMachinePosition({ zone, id, x, y });
    setLayout(getEffectiveLayout()); // reflete posição se necessário (se lista exibir coords)
    setLayoutVersion((v) => v + 1);
    setMoveMode(false);
  }

  // ====== Mover/Remover a partir da sidebar ======
  function handleMoveMachine(id) {
    setSelectedMachine(id);
    setMoveMode(true);
    setPlacementCandidateId(null);
  }

  // Abre o modal de confirmação
  function handleRemoveMachine(id) {
    if (!isOverlayMachine(selectedZone, id)) {
      alert(
        "This machine is part of the base layout and cannot be removed here."
      );
      return;
    }
    setConfirmRemoveId(id);
  }

  // Confirma remoção (executa)
  function confirmRemove() {
    if (!confirmRemoveId) return;
    const removed = removeMachineFromLayout(selectedZone, confirmRemoveId);
    if (removed && selectedMachine === confirmRemoveId) {
      setSelectedMachine(null);
    }
    setLayout(getEffectiveLayout());
    setLayoutVersion((v) => v + 1);
    setMoveMode(false);
    setConfirmRemoveId(null);
  }

  function cancelRemove() {
    setConfirmRemoveId(null);
  }
  // =====================================================

  // Cancelar mover com ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMoveMode(false);
        setPlacementCandidateId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar
        key={`sidebar-${selectedZone}-${layoutVersion}`} // garante re-render a cada mudança
        machines={zoneMachines}
        selectedMachine={selectedMachine}
        onSelectMachine={handleSelectMachine}
        onAddMachine={() => setOpenAdd(true)}
        onMoveMachine={handleMoveMachine} // ✏️
        onRemoveMachine={handleRemoveMachine} // 🗑️ abre modal
      />

      <div className="app-main">
        {/* Zona + botão de configurações do Orion */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <ZoneSelector
            selectedZone={selectedZone}
            onChangeZone={handleZoneChange}
          />

          <button
            type="button"
            onClick={() => setShowOrionSettings(true)}
            title="Orion settings"
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "1px solid rgba(0,0,0,0.08)",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            ⚙️
          </button>

        </div>

        {zoneErrors.length > 0 && (
          <div className="alert alert--info" role="status" aria-live="polite">
            <div className="alert__content">
              <span className="alert__icon" aria-hidden>
                ⚠️
              </span>
              <span className="alert__text">
                <strong>Orion:</strong> {zoneErrors.length} machine(s) without
                data
              </span>
            </div>
            <div className="alert__actions">
              <button
                className="btn btn--solid btn--sm"
                onClick={() => zoneErrors.forEach(fetchAndSetMachineData)}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="content-row">
          <div>
            <FactoryMap
              selectedZone={selectedZone}
              onSelectMachine={handleSelectMachine}
              machineData={machineData}
              selectedMachine={selectedMachine}
              placementCandidateId={placementCandidateId}
              onPlace={handlePlace}
              relocateCandidateId={moveMode ? selectedMachine : null}
              onRelocate={handleRelocate}
            />
          </div>

          {selectedMachine && (
            <MachineDetails
              machineId={selectedMachine}
              data={machineData[selectedMachine] || null}
              loading={reqState[selectedMachine]?.loading}
              error={reqState[selectedMachine]?.error}
              onRetry={() => fetchAndSetMachineData(selectedMachine)}
              Spinner={Spinner}
            />
          )}
        </div>
      </div>

      {/* Add machine */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
        <AddMachinePanel
          selectedZone={selectedZone}
          onEnterPlaceMode={handleEnterPlaceMode}
        />
      </Modal>

      {/* Orion settings */}
      <Modal
        open={showOrionSettings}
        onClose={() => setShowOrionSettings(false)}
      >
        <div style={{ minWidth: "420px", maxWidth: "520px" }}>
          <OrionSettingsPanel zoneId={selectedZone} />
        </div>
      </Modal>

      {/* Confirm remove */}
      <ConfirmDialog
        open={!!confirmRemoveId}
        title="Remove machine"
        message={
          confirmRemoveId
            ? `Are you sure you want to remove <strong>Machine ${confirmRemoveId}</strong> from Zone ${selectedZone}?`
            : ""
        }
        confirmText="Remove"
        cancelText="Cancel"
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
      />
    </div>
  );
}

export default App;
