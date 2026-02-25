const DEFAULT_ORION_CONFIG = {
  fiwareService: "robotservice",
  fiwareServicePath: "/robot",
};

function buildHeaders(config = {}) {
  const { fiwareService, fiwareServicePath } = {
    ...DEFAULT_ORION_CONFIG,
    ...config,
  };

  const headers = { Accept: "application/json" };
  if (fiwareService) headers["Fiware-Service"] = fiwareService;
  if (fiwareServicePath) headers["Fiware-ServicePath"] = fiwareServicePath;

  return headers;
}

export async function listPointsFromOrion(orionConfig = {}, opts = {}) {
  const headers = buildHeaders(orionConfig);
  const limit = Number(opts.limit ?? 200);

  const url = new URL(`/v2/entities`, window.location.origin);
  url.searchParams.set("type", "Point");
  url.searchParams.set("options", "keyValues");
  url.searchParams.set("limit", String(limit));

  const resp = await fetch(url.pathname + url.search, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Orion error ${resp.status}: ${text || resp.statusText}`);
  }

  const points = await resp.json();
  if (!Array.isArray(points)) return [];

  const robotId = opts.robotId || null;
  const filtered = robotId ? points.filter((p) => p.robotId === robotId) : points;

  // Sort for nicer UX: HOME first, SAFE second, then alphabetical
  filtered.sort((a, b) => {
    const rank = (x) => {
      const id = String(x?.id || "");
      if (id === "Point:HOME") return 0;
      if (id === "Point:SAFE") return 1;
      return 10;
    };
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });

  return filtered;
}