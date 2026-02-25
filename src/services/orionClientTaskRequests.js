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

function shortId() {
  // browser-safe
  return Math.random().toString(16).slice(2, 10);
}

export async function createTaskRequestInOrion(orionConfig = {}, payload = {}) {
  const headers = buildHeaders(orionConfig);

  const {
    robotId,
    processId = "Process:pickplace-01",
    pickPointId,
    placePointId,
  } = payload;

  if (!robotId) throw new Error("robotId is required");
  if (!pickPointId) throw new Error("pickPointId is required");
  if (!placePointId) throw new Error("placePointId is required");

  const nowIso = new Date().toISOString();
  const id = `TaskRequest:taskreq-${shortId()}`;

  const entity = {
    id,
    type: "TaskRequest",
    status: { type: "Text", value: "pending" },
    robotId: { type: "Text", value: robotId },
    processId: { type: "Text", value: processId },
    pickPointId: { type: "Text", value: pickPointId },
    placePointId: { type: "Text", value: placePointId },
    createdAt: { type: "Text", value: nowIso },
  };

  const resp = await fetch(`/v2/entities`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(entity),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Create TaskRequest failed ${resp.status}: ${text || resp.statusText}`);
  }

  return { ok: true, id };
}