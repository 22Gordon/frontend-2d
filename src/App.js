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
  exportEffectiveLayoutAsJson,
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

  // <<<<< agora faz fetch imediato ao Orion para pintar o estado logo
  function handlePlace({ id, x, y, zone }) {
    addMachineToLayout({ zone, id, x, y, status: "inactive" });
    setPlacementCandidateId(null);
    fetchAndSetMachineData(id);
  }

  function handleRelocate({ id, x, y, zone }) {
    setMachinePosition({ zone, id, x, y });
    setMoveMode(false);
  }

  function handleRemoveSelected() {
    if (!selectedMachine) return;
    const ok = window.confirm(`Remove machine ${selectedMachine} from zone ${selectedZone}?`);
    if (!ok) return;
    const removed = removeMachineFromLayout(selectedZone, selectedMachine);
    if (!removed) {
      alert("This machine comes from the base layout and can't be removed here.");
    }
    setSelectedMachine(null);
    setMoveMode(false);
  }

  return (
    <div className="app-shell">
      <Sidebar
        machines={zoneMachines}
        selectedMachine={selectedMachine}
        onSelectMachine={handleSelectMachine}
        onAddMachine={() => setOpenAdd(true)}
      />

      <div className="app-main">
        <ZoneSelector selectedZone={selectedZone} onChangeZone={handleZoneChange} />

        {zoneErrors.length > 0 && (
          <div className="alert">
            <strong>Orion:</strong> {zoneErrors.length} máquina(s) sem dados{" "}
            <button
              className="btn btn--solid"
              onClick={() => zoneErrors.forEach(fetchAndSetMachineData)}
            >
              Tentar novamente
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

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn--ghost" onClick={() => setOpenAdd(true)}>
                Add machine…
              </button>
              <button className="btn" onClick={exportEffectiveLayoutAsJson}>
                Export layout
              </button>

              {placementCandidateId && (
                <button className="btn btn--ghost" onClick={() => setPlacementCandidateId(null)}>
                  Cancel place
                </button>
              )}

              {selectedMachine && (
                <>
                  <span style={{ marginLeft: 8, opacity: .6 }}>Selected: {selectedMachine}</span>

                  {!moveMode ? (
                    <button className="btn btn--ghost" onClick={() => { setMoveMode(true); setPlacementCandidateId(null); }}>
                      Move (click on map)
                    </button>
                  ) : (
                    <button className="btn btn--solid" onClick={() => setMoveMode(false)}>
                      Cancel move
                    </button>
                  )}

                  <button
                    className="btn btn--ghost"
                    onClick={handleRemoveSelected}
                    disabled={!isOverlayMachine(selectedZone, selectedMachine)}
                    title={
                      isOverlayMachine(selectedZone, selectedMachine)
                        ? "Remove from overlay"
                        : "Locked (base layout)"
                    }
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
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
        <AddMachinePanel
          selectedZone={selectedZone}
          onEnterPlaceMode={handleEnterPlaceMode}
        />
      </Modal>
    </div>
  );
}

export default App;
