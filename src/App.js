import React, { useState } from "react";
import FactoryMap from "./components/FactoryMap";

function App() {
  const [selectedMachine, setSelectedMachine] = useState(null);

  return (
    <div>
      <FactoryMap onSelectMachine={setSelectedMachine} />
      {selectedMachine && <div>Máquina selecionada: {selectedMachine}</div>}
    </div>
  );
}

export default App;
