import React, { useState, useEffect, useCallback } from "react";
import "./index.css";
import "./styles/ui.css";
import FactoryMap from "./components/FactoryMap";
import MachineDetails from "./components/MachineDetails";
import ZoneSelector from "./components/ZoneSelector";
import Sidebar from "./components/Sidebar";
import Spinner from "./components/Spinner";
import layoutData from "./layout/layout.json";
import { getMachineDataFromOrion } from "./services/orionClient";

function App() {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedZone, setSelectedZone] = useState("A");
  const [machineData, setMachineData] = useState({});
  const [reqState, setReqState] = useState({}); // { [id]: { loading: bool, error: string|null } }

  const setLoading = (id, loading) =>
    setReqState(prev => ({ ...prev, [id]: { ...(prev[id]||{}), loading, ...(loading ? { error:null } : {}) }}));
  const setError = (id, error) =>
    setReqState(prev => ({ ...prev, [id]: { ...(prev[id]||{}), loading:false, error } }));

  const fetchAndSetMachineData = useCallback(async (machineId) => {
    try {
      setLoading(machineId, true);
      const data = await getMachineDataFromOrion(machineId);
      if (data) {
        setMachineData(prev => ({ ...prev, [machineId]: data }));
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

  useEffect(() => {
    const interval = setInterval(() => {
      const zoneMachines = layoutData[selectedZone]?.machines || {};
      Object.keys(zoneMachines).forEach(fetchAndSetMachineData);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedZone, fetchAndSetMachineData]);

  const handleZoneChange = (zone) => {
    setSelectedZone(zone);
    setSelectedMachine(null);
  };

  const zoneMachines = layoutData[selectedZone]?.machines || {};

  // algum erro recente nesta zona?
  const zoneErrors = Object.keys(zoneMachines).filter(id => reqState[id]?.error);

  return (
    <div className="app-shell">
      <Sidebar
        machines={Object.keys(zoneMachines)}
        selectedMachine={selectedMachine}
        onSelectMachine={handleSelectMachine}
      />

      <div className="app-main">
        <ZoneSelector selectedZone={selectedZone} onChangeZone={handleZoneChange} />

        {zoneErrors.length > 0 && (
          <div className="alert">
            <strong>Orion:</strong> {zoneErrors.length} máquina(s) sem dados.
            {" "}
            <button className="btn btn--solid" onClick={() => zoneErrors.forEach(fetchAndSetMachineData)}>
              Tentar novamente
            </button>
          </div>
        )}

        <div className="content-row">
          <FactoryMap
            selectedZone={selectedZone}
            onSelectMachine={handleSelectMachine}
            machineData={machineData}
            selectedMachine={selectedMachine}
            requestState={reqState}   // <- para feedback no mapa (opcional)
          />

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
    </div>
  );
}
export default App;
