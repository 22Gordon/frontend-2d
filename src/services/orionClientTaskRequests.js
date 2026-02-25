const DEFAULT_ORION_CONFIG = {
  fiwareService: "robotservice",
  fiwareServicePath: "/robot",
};

function buildHeaders(config = {}) {
  const { fiwareService, fiwareServicePath } = { ...DEFAULT_ORION_CONFIG, ...config };

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (fiwareService) headers["Fiware-Service"] = fiwareService;
  if (fiwareServicePath) headers["Fiware-ServicePath"] = fiwareServicePath;

  return headers;
}

function makeId(prefix) {
  // id simples para já
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function createTaskRequestInOrion(orionConfig = {}, payload = {}) {
  const headers = buildHeaders(orionConfig);

  const id = payload.id || `TaskRequest:taskreq-${makeId("req")}`;
  const createdAt = new Date().toISOString();

  const entity = {
    id,
    type: "TaskRequest",
    status: { type: "Text", value: "pending" },
    createdAt: { type: "Text", value: createdAt },

    robotId: { type: "Text", value: payload.robotId },
    processId: { type: "Text", value: payload.processId || "Process:pickplace-01" },

 
    pickPointId: { type: "Text", value: payload.pickPointId },
    placePointId: { type: "Text", value: payload.placePointId },

    ...(Array.isArray(payload.steps) && payload.steps.length > 0
      ? { steps: { type: "StructuredValue", value: payload.steps } }
      : {}),
  };

  const resp = await fetch(`/v2/entities`, {
    method: "POST",
    headers,
    body: JSON.stringify(entity),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Create TaskRequest failed ${resp.status}: ${text || resp.statusText}`);
  }

  return { ok: true, id };
}