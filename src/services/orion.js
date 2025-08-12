// src/services/orion.js
const FIWARE_HEADERS = {
  "Fiware-Service": "textileservice",
  "Fiware-ServicePath": "/textile",
  Accept: "application/json",
};

async function listIdsByType(entityType) {
  const url = `/v2/entities?type=${encodeURIComponent(
    entityType
  )}&options=keyValues&attrs=id`;
  const res = await fetch(url, { headers: FIWARE_HEADERS });
  if (!res.ok) {
    // devolve lista vazia para não partir o painel
    console.warn(`[Orion] listIdsByType ${entityType} -> ${res.status}`);
    return [];
  }
  const arr = await res.json(); // [{id:"emeter-312"}, ...]
  return arr
    .map((e) => e.id || "")
    .map((id) => {
      // extrai numero do padrão "<tipo>-<id>"
      const m = String(id).match(/[-:]?(\d+)$/);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

/**
 * IDs de máquinas conhecidos pelo Orion deduzidos dos sensores
 * (emeter, gmeter, dmeter), deduplicados e ordenados.
 */
export async function fetchOrionMachineIds() {
  const parts = await Promise.all([
    listIdsByType("emeter"),
    listIdsByType("gmeter"),
    listIdsByType("dmeter"),
  ]);
  const set = new Set(parts.flat());
  return Array.from(set).sort((a, b) => Number(a) - Number(b));
}
