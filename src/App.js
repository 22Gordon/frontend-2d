import React, { useState, useEffect, useCallback } from "react";
import FactoryMap from "./components/FactoryMap";
import MachineDetails from "./components/MachineDetails";
import ZoneSelector from "./components/ZoneSelector";
import layoutData from "./layout/layout.json";
import { getMachineDataFromOrion } from "./services/orionClient";

function App() {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedZone, setSelectedZone] = useState("A");
  const [machineData, setMachineData] = useState({});

  const fetchAndSetMachineData = useCallback(async (machineId) => {
    const data = await getMachineDataFromOrion(machineId);
    if (data) {
      setMachineData((prev) => ({ ...prev, [machineId]: data }));
    }
  }, []);

  const handleSelectMachine = (machineId) => {
    setSelectedMachine(machineId);
    fetchAndSetMachineData(machineId);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const zoneMachines = layoutData[selectedZone]?.machines || {};
      Object.keys(zoneMachines).forEach((id) => {
        fetchAndSetMachineData(id);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedZone, fetchAndSetMachineData]);

  const handleZoneChange = (zone) => {
    setSelectedZone(zone);
    setSelectedMachine(null);
  };

  return (
    <div style={{ padding: 30 }}>
      <ZoneSelector selectedZone={selectedZone} onChangeZone={handleZoneChange} />

      <div style={{ display: "flex", gap: 60 }}>
        <FactoryMap
          selectedZone={selectedZone}
          onSelectMachine={handleSelectMachine}
          machineData={machineData}
        />
        <div>
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
