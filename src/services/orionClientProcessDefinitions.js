const DEFAULT_ORION_CONFIG = {
  fiwareService: "textileservice",
  fiwareServicePath: "/textile",
};

function buildHeaders(config = {}, options = {}) {
  const { fiwareService, fiwareServicePath } = {
    ...DEFAULT_ORION_CONFIG,
    ...config,
  };

  const headers = {
    Accept: "application/json",
  };

  if (options.includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  if (fiwareService) headers["Fiware-Service"] = fiwareService;
  if (fiwareServicePath) headers["Fiware-ServicePath"] = fiwareServicePath;

  return headers;
}

function mapProcessDefinitionEntity(entity) {
  return {
    id: entity.id,
    type: entity.type,
    label: entity.label?.value || "",
    robotId: entity.robotId?.value || "",
    processId: entity.processId?.value || "",
    steps: entity.steps?.value || [],
    loopMode: entity.loopMode?.value || "off",
    loopCount: entity.loopCount?.value ?? 1,
    source: entity.source?.value || "",
    createdAt: entity.createdAt?.value || "",
    updatedAt: entity.updatedAt?.value || "",
  };
}

export async function listProcessDefinitionsFromOrion(
  orionConfig = {},
  { robotId, limit = 100 } = {}
) {
  const headers = buildHeaders(orionConfig);

  const params = new URLSearchParams();
  params.set("type", "ProcessDefinition");
  params.set("limit", String(limit));
  params.set(
    "attrs",
    "label,robotId,processId,steps,loopMode,loopCount,source,createdAt,updatedAt"
  );

  const response = await fetch(`/v2/entities?${params.toString()}`, {
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[ProcessDefinitions] list failed:", response.status, text);
    throw new Error(text || `Failed to load process definitions (${response.status})`);
  }

  const data = await response.json();
  const mapped = Array.isArray(data) ? data.map(mapProcessDefinitionEntity) : [];

  if (!robotId) return mapped;
  return mapped.filter((p) => p.robotId === robotId);
}

export async function createProcessDefinitionInOrion(
  orionConfig = {},
  payload
) {
  const headers = buildHeaders(orionConfig, { includeContentType: true });
  const now = new Date().toISOString();

  const safeLabel = String(payload?.label || "").trim();
  const safeRobotId = String(payload?.robotId || "").trim();
  const safeProcessId = String(payload?.processId || "Process:custom-01").trim();

  if (!safeLabel) {
    throw new Error("Process label is required");
  }

  if (!safeRobotId) {
    throw new Error("robotId is required");
  }

  const slug = safeLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  const entityId = `ProcessDefinition:${slug || "process"}-${Date.now()}`;

  const entity = {
    id: entityId,
    type: "ProcessDefinition",
    label: { type: "Text", value: safeLabel },
    robotId: { type: "Text", value: safeRobotId },
    processId: { type: "Text", value: safeProcessId },
    steps: {
      type: "StructuredValue",
      value: Array.isArray(payload?.steps) ? payload.steps : [],
    },
    loopMode: {
      type: "Text",
      value: String(payload?.loopMode || "off"),
    },
    loopCount: {
      type: "Integer",
      value: Number.isFinite(Number(payload?.loopCount))
        ? Number(payload.loopCount)
        : 1,
    },
    source: {
      type: "Text",
      value: String(payload?.source || "frontend"),
    },
    createdAt: { type: "DateTime", value: now },
    updatedAt: { type: "DateTime", value: now },
  };

  const response = await fetch("/v2/entities", {
    method: "POST",
    headers,
    body: JSON.stringify(entity),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text || `Failed to create process definition (${response.status})`
    );
  }

  return mapProcessDefinitionEntity(entity);
}

export async function deleteProcessDefinitionFromOrion(
  entityId,
  orionConfig = {}
) {
  if (!entityId) {
    throw new Error("ProcessDefinition id is required");
  }

  const headers = buildHeaders(orionConfig);

  const response = await fetch(`/v2/entities/${encodeURIComponent(entityId)}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      text || `Failed to delete process definition (${response.status})`
    );
  }

  return { ok: true };
}