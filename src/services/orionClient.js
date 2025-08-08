export async function getMachineDataFromOrion(machineId) {
    const url = `/v2/entities/urn:ngsi-ld:Machine:machine-${machineId}`;
  
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao obter dados do Orion");
      const data = await response.json();  // aqui falha se vier HTML
      return data;
    } catch (err) {
      console.error("Erro ao obter dados do Orion:", err);
      return null;
    }
  }
  