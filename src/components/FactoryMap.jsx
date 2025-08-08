import React, { useEffect, useState } from "react";
import { Stage, Layer, Rect, Text } from "react-konva";
import layoutData from "../layout/layout.json";

const BOX_WIDTH = 60;
const BOX_HEIGHT = 60;

function FactoryMap({ onSelectMachine, machineData }) {
  const [machines, setMachines] = useState({});

  useEffect(() => {
    setMachines(layoutData);
  }, []);

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
                onClick={() => onSelectMachine(id)}
              />
              <Text
                x={data.position.x}
                y={data.position.y + BOX_HEIGHT + 5}
                text={`Machine ${id}`}
                fontSize={14}
                fill="#fff"
              />
            </React.Fragment>
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

export default FactoryMap;
