import React, { useState } from "react";
import FactoryMap from "./components/FactoryMap";
import MachineDetails from "./components/MachineDetails";

function App() {
  const [selectedMachineId, setSelectedMachineId] = useState(null);

  return (
    <div style={{ display: "flex", padding: "20px" }}>
      <FactoryMap onSelectMachine={setSelectedMachineId} />
      <MachineDetails machineId={selectedMachineId} />
    </div>
  );
}

export default App;
