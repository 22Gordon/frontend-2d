import React, { useEffect, useState } from "react";
import { Stage, Layer, Rect, Text } from "react-konva";
import layoutData from "../layout/layout.json";

const BOX_WIDTH = 60;
const BOX_HEIGHT = 60;

function FactoryMap({ onSelectMachine }) {
  const [machines, setMachines] = useState({});

  useEffect(() => {
    // Carregar layout ao iniciar
    setMachines(layoutData);
  }, []);

  const handleSelect = (id) => {
    if (onSelectMachine && typeof onSelectMachine === "function") {
      onSelectMachine(id);
    }
  };

  return (
    <div>
      <Stage width={800} height={400}>
        <Layer>
          {Object.entries(machines).map(([id, data]) => (
            <React.Fragment key={id}>
              <Rect
                x={data.position.x}
                y={data.position.y}
                width={BOX_WIDTH}
                height={BOX_HEIGHT}
                fill={data.status === "active" ? "green" : "red"}
                cornerRadius={10}
                shadowBlur={5}
                onClick={() => handleSelect(id)}
              />
              <Text
                x={data.position.x}
                y={data.position.y + BOX_HEIGHT + 5}
                text={`Machine ${id}`}
                fontSize={14}
                fill="#fff"
                shadowColor="black"
                shadowBlur={2}
                shadowOffset={{ x: 1, y: 1 }}
                shadowOpacity={0.6}
              />
            </React.Fragment>
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

export default FactoryMap;
