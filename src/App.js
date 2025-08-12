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
} from "./utils/layoutStore";

function App() {
  const [selectedZone, setSelectedZone] = useState("A");
  const [selectedMachine, setSelectedMachine] = useState(null);

  const [machineData, setMachineData] = useState({});
  const [reqState, setReqState] = useState({}); // { [id]: { loading, error } }

  // UI: painel Add + modo colocação
  const [openAdd, setOpenAdd] = useState(false);
  const [placementCandidateId, setPlacementCandidateId] = useState(null);

  // layout atual (json + overlay) e máquinas da zona, para render
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

  // Polling: 1 intervalo por zona. Busca ids “na hora” do layout efetivo.
  useEffect(() => {
    function tick() {
      const layoutNow = getEffectiveLayout();
      const ids = Object.keys(layoutNow[selectedZone]?.machines || {});
      ids.forEach(fetchAndSetMachineData);
    }

    tick(); // primeira corrida imediata
    const interval = setInterval(tick, 8000); // ajusta 5–10s conforme precisares
    return () => clearInterval(interval);
  }, [selectedZone, fetchAndSetMachineData]);

  const handleZoneChange = (zone) => {
    setSelectedZone(zone);
    setSelectedMachine(null);
  };

  // erros recentes nesta zona
  const zoneErrors = zoneMachines.filter((id) => reqState[id]?.error);

  // Add machine: entrar em modo colocação
  function handleEnterPlaceMode(id) {
    setPlacementCandidateId(id);
    setOpenAdd(false);
  }

  // Add machine: click no mapa → guardar no overlay
  function handlePlace({ id, x, y, zone }) {
    addMachineToLayout({ zone, id, x, y, status: "inactive" });
    setPlacementCandidateId(null);
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
            />

            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
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
