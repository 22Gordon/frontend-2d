export async function getMachineDataFromOrion(machineId) {
  const sensorTypes = ["emeter", "gmeter", "dmeter"];
  const headers = {
    "Fiware-Service": "textileservice",
    "Fiware-ServicePath": "/textile"
  };

  const data = {};

  for (const type of sensorTypes) {
    const entityId = `${type}-${machineId}`;
    try {
      const response = await fetch(`/v2/entities/${entityId}`, { headers });
      if (!response.ok) continue;
      const entityData = await response.json();

      Object.entries(entityData).forEach(([key, value]) => {
        if (key !== "id" && key !== "type") {
          data[key] = value;
        }
      });
    } catch (err) {
      if (err.message.includes("404")) {
        console.warn(`Entidade não encontrada: ${entityId}`);
      } else {
        console.error(`Erro ao obter dados da entidade ${entityId}:`, err);
      }
    }
  }

  return Object.keys(data).length > 0 ? data : null;
}