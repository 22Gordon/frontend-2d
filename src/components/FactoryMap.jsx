import React, { useEffect, useState } from "react";
import { Stage, Layer, Rect, Text } from "react-konva";
import layoutData from "../layout/layout.json";
import { getMachineDataFromOrion } from "../services/orionClient";

const BOX_WIDTH = 60;
const BOX_HEIGHT = 60;

function FactoryMap({ onSelectMachine, onUpdateData, machineData }) {
  const [machines, setMachines] = useState({});

  useEffect(() => {
    setMachines(layoutData);
  }, []);

  useEffect(() => {
    const intervals = [];

    Object.entries(machines).forEach(([id, machine]) => {
      const isActive = machine.status === "active";
      if (isActive) {
        const interval = setInterval(async () => {
          const data = await getMachineDataFromOrion(id);
          if (data) {
            onUpdateData(id, data);
          }
        }, 5000);
        intervals.push(interval);
      }
    });

    return () => intervals.forEach((int) => clearInterval(int));
  }, [machines, onUpdateData]);

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
                onClick={() => {
                  onSelectMachine(id);
                  if (data.status === "active") {
                    getMachineDataFromOrion(id).then((d) => {
                      if (d) onUpdateData(id, d);
                    });
                  }
                }}
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
