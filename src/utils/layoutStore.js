import rawLayout from "../layout/layout.json";

const LS_KEY = "factory_layout_overlay_v1";

function loadOverlay() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
function saveOverlay(overlay) { localStorage.setItem(LS_KEY, JSON.stringify(overlay)); }

let overlay = loadOverlay(); // { [zone]: { machines: { [id]: {...} } } }

export function getEffectiveLayout() {
  const out = JSON.parse(JSON.stringify(rawLayout));
  for (const zone of Object.keys(overlay)) {
    out[zone] = out[zone] || { image: "", machines: {} };
    out[zone].machines = { ...(out[zone].machines || {}), ...(overlay[zone].machines || {}) };
  }
  return out;
}

export function listLayoutMachineIds(layoutObj = getEffectiveLayout()) {
  const ids = [];
  for (const zone of Object.keys(layoutObj)) {
    const ms = layoutObj[zone]?.machines || {};
    ids.push(...Object.keys(ms));
  }
  return Array.from(new Set(ids));
}

export function addMachineToLayout({ zone, id, x, y, status = "inactive" }) {
  overlay[zone] = overlay[zone] || { machines: {} };
  overlay[zone].machines = overlay[zone].machines || {};
  overlay[zone].machines[id] = { position: { x, y }, status };
  saveOverlay(overlay);
}

export function exportEffectiveLayoutAsJson() {
  const eff = getEffectiveLayout();
  const blob = new Blob([JSON.stringify(eff, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "layout.export.json";
  a.click();
  URL.revokeObjectURL(url);
}


// Em que zona está um id (considera layout efetivo)
export function findMachineZone(id, layoutObj = getEffectiveLayout()) {
  for (const z of Object.keys(layoutObj)) {
    if (layoutObj[z]?.machines && layoutObj[z].machines[id]) return z;
  }
  return null;
}

// é uma máquina criada no overlay (não no JSON base)?
export function isOverlayMachine(zone, id) {
  return Boolean(overlay[zone]?.machines && overlay[zone].machines[id]);
}

// remover (apenas overlay por agora; não apaga layout base)
export function removeMachineFromLayout(zone, id) {
  if (!overlay[zone]?.machines?.[id]) return false; // não existe no overlay
  delete overlay[zone].machines[id];
  if (Object.keys(overlay[zone].machines).length === 0) delete overlay[zone].machines;
  if (Object.keys(overlay[zone] || {}).length === 0) delete overlay[zone];
  saveOverlay(overlay);
  return true;
}

// mover entre zonas (apenas overlay da origem, cria na nova)
export function moveMachineToZone({ id, fromZone, toZone, x, y }) {
  if (overlay[fromZone]?.machines?.[id]) {
    delete overlay[fromZone].machines[id];
  }
  addMachineToLayout({ zone: toZone, id, x, y, status: "inactive" });
}

// atualizar posição (se não existir no overlay, cria override)
export function setMachinePosition({ zone, id, x, y }) {
  overlay[zone] = overlay[zone] || { machines: {} };
  overlay[zone].machines = overlay[zone].machines || {};
  const existing = overlay[zone].machines[id];

  if (!existing) {
    overlay[zone].machines[id] = { position: { x, y }, status: "inactive" };
  } else {
    overlay[zone].machines[id].position = { x, y };
  }
  saveOverlay(overlay);
  return true;
}