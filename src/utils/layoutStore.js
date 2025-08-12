import rawLayout from "../layout/layout.json";

const LS_KEY = "factory_layout_overlay_v1";

function loadOverlay() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveOverlay(overlay) {
  localStorage.setItem(LS_KEY, JSON.stringify(overlay));
}

let overlay = loadOverlay(); // { [zone]: { machines: { [id]: { position, status } } } }

export function getEffectiveLayout() {
  // merge superficial: rawLayout + overlay
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
  overlay[zone].machines[id] = {
    position: { x, y },
    status,
  };
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
