import React, { useState, useEffect, useCallback } from "react";
import "./index.css";
import FactoryMap from "./components/FactoryMap";
import MachineDetails from "./components/MachineDetails";
import ZoneSelector from "./components/ZoneSelector";
import Sidebar from "./components/Sidebar";
import layoutData from "./layout/layout.json";
import { getMachineDataFromOrion } from "./services/orionClient";
import "./styles/ui.css";


function App() {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedZone, setSelectedZone] = useState("A");
  const [machineData, setMachineData] = useState({});

  const fetchAndSetMachineData = useCallback(async (machineId) => {
    const data = await getMachineDataFromOrion(machineId);
    if (data) setMachineData((prev) => ({ ...prev, [machineId]: data }));
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

  return (
    <div className="app-shell">
      <Sidebar
        machines={Object.keys(zoneMachines)}
        selectedMachine={selectedMachine}
        onSelectMachine={handleSelectMachine}
      />

      <div className="app-main">
        <ZoneSelector selectedZone={selectedZone} onChangeZone={handleZoneChange} />

        <div className="content-row">
          <FactoryMap
            selectedZone={selectedZone}
            onSelectMachine={handleSelectMachine}
            machineData={machineData}
            selectedMachine={selectedMachine} // necessário para o destaque
          />

          {selectedMachine && (
            <MachineDetails
              machineId={selectedMachine}
              data={machineData[selectedMachine] || null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
export default App;
