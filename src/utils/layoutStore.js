// utils/layoutStore.js
import rawLayout from "../layout/layout.json";

const LS_KEY = "factory_layout_overlay_v1";

function loadOverlay() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
function saveOverlay(nextOverlay) {
  localStorage.setItem(LS_KEY, JSON.stringify(nextOverlay));
  try { window.dispatchEvent(new CustomEvent("layout:updated")); } catch (_) {}
}

// overlay vivo em memória (NÃO sobrescrever esta ref noutros sítios)
let overlay = loadOverlay();
// Estrutura:
// overlay[zone] = { image?, baseWidth?, baseHeight?, machines?: { [id]: { position:{x,y}, status } } }

/** Junta layout base com overlay (imagem/baseW/H + máquinas) */
export function getEffectiveLayout() {
  const out = JSON.parse(JSON.stringify(rawLayout || {}));
  for (const zone of Object.keys(overlay)) {
    const ovz = overlay[zone] || {};
    out[zone] = out[zone] || { image: "", machines: {} };

    if (ovz.image) out[zone].image = ovz.image;
    if (ovz.baseWidth) out[zone].baseWidth = ovz.baseWidth;
    if (ovz.baseHeight) out[zone].baseHeight = ovz.baseHeight;

    out[zone].machines = {
      ...(out[zone].machines || {}),
      ...(ovz.machines || {})
    };
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

/** Adiciona/atualiza uma ZONA no overlay (imagem, dimensões, etc.) */
export function upsertZone(zone, zoneObj) {
  overlay[zone] = overlay[zone] || { machines: {} };
  const prevMachines = overlay[zone].machines || {};
  const nextMachines = zoneObj.machines ? { ...prevMachines, ...zoneObj.machines } : prevMachines;

  overlay[zone] = { ...overlay[zone], ...zoneObj, machines: nextMachines };
  saveOverlay(overlay);
}

/** pode remover? só se não for zona do layout base */
export function isRemovableZone(zone) {
  return !Object.prototype.hasOwnProperty.call(rawLayout, zone);
}

/** remove zona inteira do overlay (não toca no layout base) */
export function removeZone(zone) {
  if (!overlay[zone]) return false;         // só remove se existir no overlay
  delete overlay[zone];                     // altera o OBJETO VIVO em memória
  saveOverlay(overlay);                     // persiste e emite "layout:updated"
  return true;
}

/** Lista zonas do layout efetivo (base + overlay) */
export function listZones() {
  return Object.keys(getEffectiveLayout());
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
  a.href = url; a.download = "layout.export.json"; a.click();
  URL.revokeObjectURL(url);
}

export function findMachineZone(id, layoutObj = getEffectiveLayout()) {
  for (const z of Object.keys(layoutObj)) {
    if (layoutObj[z]?.machines && layoutObj[z].machines[id]) return z;
  }
  return null;
}

export function isOverlayMachine(zone, id) {
  return Boolean(overlay[zone]?.machines && overlay[zone].machines[id]);
}

export function removeMachineFromLayout(zone, id) {
  if (!overlay[zone]?.machines?.[id]) return false;
  delete overlay[zone].machines[id];
  if (Object.keys(overlay[zone].machines).length === 0) delete overlay[zone].machines;
  if (Object.keys(overlay[zone] || {}).length === 0) delete overlay[zone];
  saveOverlay(overlay);
  return true;
}

export function moveMachineToZone({ id, fromZone, toZone, x, y }) {
  if (overlay[fromZone]?.machines?.[id]) {
    delete overlay[fromZone].machines[id];
  }
  addMachineToLayout({ zone: toZone, id, x, y, status: "inactive" });
}

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
