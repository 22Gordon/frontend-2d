import React, { useState, useEffect } from "react";
import FactoryMap from "./components/FactoryMap";
import MachineDetails from "./components/MachineDetails";
import { getMachineDataFromOrion } from "./services/orionClient";

function App() {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machineData, setMachineData] = useState({});

  const handleSelectMachine = (machineId) => {
    setSelectedMachine(machineId);
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      const ids = ["312"]; // IDs das máquinas a atualizar automaticamente
      for (const id of ids) {
        const data = await getMachineDataFromOrion(id);
        if (data) {
          setMachineData((prev) => ({ ...prev, [id]: data }));
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", padding: 40 }}>
      <FactoryMap
        onSelectMachine={handleSelectMachine}
        onUpdateData={(id, data) =>
          setMachineData((prev) => ({ ...prev, [id]: data }))
        }
        machineData={machineData}
      />
      <div style={{ marginLeft: 60 }}>
        {selectedMachine && (
          <MachineDetails
            machineId={selectedMachine}
            data={machineData[selectedMachine] || null}
          />
        )}
      </div>
    </div>
  );
}

export default App;
