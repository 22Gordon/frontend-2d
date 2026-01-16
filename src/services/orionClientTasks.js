const DEFAULT_ORION_CONFIG = {
  fiwareService: "robotService",
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

/**
 * Lista Tasks (keyValues) e opcionalmente filtra por robotId.
 * @param {object} orionConfig
 * @param {object} opts { limit, robotId }
 */
export async function listTasksFromOrion(orionConfig = {}, opts = {}) {
  const headers = buildHeaders(orionConfig);
  const limit = Number(opts.limit ?? 30);

  const url = new URL(`/v2/entities`, window.location.origin);
  url.searchParams.set("type", "Task");
  url.searchParams.set("options", "keyValues");
  url.searchParams.set("limit", String(limit));

  const resp = await fetch(url.pathname + url.search, { headers });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Orion error ${resp.status}: ${text || resp.statusText}`);
  }

  const tasks = await resp.json();
  if (!Array.isArray(tasks)) return [];

  const robotId = opts.robotId || null;
  return robotId ? tasks.filter((t) => t.robotId === robotId) : tasks;
}
