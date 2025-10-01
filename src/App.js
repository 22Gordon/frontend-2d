// src/App.js
import React, { useState, useEffect, useCallback } from "react";
import "./index.css";
import "./styles/ui.css";

import FactoryMap from "./components/FactoryMap";
import MachineDetails from "./components/MachineDetails";
import ZoneSelector from "./components/ZoneSelector";
import Sidebar from "./components/Sidebar";
import Spinner from "./components/Spinner";
import AddMachinePanel from "./components/AddMachinePanel";
import Modal from "./components/Modal";

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

  // layout atual e máquinas da zona
  const layout = getEffectiveLayout();
  const zoneMachines = Object.keys(layout[selectedZone]?.machines || {});

  // helpers de estado de pedidos
  const setLoading = (id, loading) =>
    setReqState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), loading, ...(loading ? { error: null } : {}) },
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

  // Polling por zona
  useEffect(() => {
    function tick() {
      const layoutNow = getEffectiveLayout();
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
    setPlacementCandidateId(null);
    fetchAndSetMachineData(id);
  }

  function handleRelocate({ id, x, y, zone }) {
    setMachinePosition({ zone, id, x, y });
    setMoveMode(false);
  }

  // ====== NOVO: mover/remover a partir da sidebar ======
  function handleMoveMachine(id) {
    setSelectedMachine(id);
    setMoveMode(true);
    setPlacementCandidateId(null);
  }

  function handleRemoveMachine(id) {
    if (!isOverlayMachine(selectedZone, id)) {
      alert("This machine is part of the base layout and cannot be removed here.");
      return;
    }
    const ok = window.confirm(`Remove machine ${id} from zone ${selectedZone}?`);
    if (!ok) return;

    const removed = removeMachineFromLayout(selectedZone, id);
    if (!removed) return;

    if (selectedMachine === id) setSelectedMachine(null);
    setMoveMode(false);
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
        machines={zoneMachines}
        selectedMachine={selectedMachine}
        onSelectMachine={handleSelectMachine}
        onAddMachine={() => setOpenAdd(true)}
        onMoveMachine={handleMoveMachine}        // << ícone ✏️
        onRemoveMachine={handleRemoveMachine}    // << ícone 🗑️
      />

      <div className="app-main">
        <ZoneSelector selectedZone={selectedZone} onChangeZone={handleZoneChange} />

        {zoneErrors.length > 0 && (
          <div className="alert">
            <strong>Orion:</strong> {zoneErrors.length} machine(s) without data{" "}
            <button
              className="btn btn--solid"
              onClick={() => zoneErrors.forEach(fetchAndSetMachineData)}
            >
              Retry
            </button>
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

            {/* ⛔️ BARRA DE BOTÕES REMOVIDA
                - Add machine…
                - Export layout
                - Selected / Move / Cancel move
                - Remove
            */}
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

      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
        <AddMachinePanel selectedZone={selectedZone} onEnterPlaceMode={handleEnterPlaceMode} />
      </Modal>
    </div>
  );
}

export default App;
