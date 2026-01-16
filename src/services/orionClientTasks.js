const DEFAULT_ORION_CONFIG = {
  fiwareService: "robotservice",
  fiwareServicePath: "/robot",
};

function buildHeaders(config = {}) {
  const { fiwareService, fiwareServicePath } = {
    ...DEFAULT_ORION_CONFIG,
    ...config,
  };

  // ✅ Sem Content-Type (especialmente importante para DELETE)
  const headers = { Accept: "application/json" };
  if (fiwareService) headers["Fiware-Service"] = fiwareService;
  if (fiwareServicePath) headers["Fiware-ServicePath"] = fiwareServicePath;

  return headers;
}

export async function listTasksFromOrion(orionConfig = {}, opts = {}) {
  const headers = buildHeaders(orionConfig);
  const limit = Number(opts.limit ?? 50);

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

//apagar uma Task no Orion
export async function deleteTaskFromOrion(taskId, orionConfig = {}) {
  const headers = buildHeaders(orionConfig);

  const resp = await fetch(`/v2/entities/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
    headers,
  });

  // Orion retorna 204 normalmente
  if (!resp.ok && resp.status !== 204) {
    const text = await resp.text();
    throw new Error(`Delete failed ${resp.status}: ${text || resp.statusText}`);
  }

  return true;
}
