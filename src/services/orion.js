const DEFAULT_ORION_CONFIG = {
  fiwareService: "textileservice",
  fiwareServicePath: "/textile",
  entityPrefixes: "emeter, gmeter, dmeter",
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
 * Transforma a string de prefixes numa lista de templates com {id}.
 *
 * Exemplos:
 *   "emeter, gmeter"       -> ["emeter-{id}", "gmeter-{id}"]
 *   "RoboticArm:,Gripper:" -> ["RoboticArm:{id}", "Gripper:{id}"]
 *   "emeter-{id}"          -> ["emeter-{id}"]
 */
function parseEntityTemplates(prefixString) {
  const raw =
    typeof prefixString === "string" && prefixString.trim().length > 0
      ? prefixString
      : DEFAULT_ORION_CONFIG.entityPrefixes;

  return raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((token) => {
      if (token.includes("{id}")) return token;
      if (token.endsWith("-") || token.endsWith(":") || token.endsWith("_")) {
        return `${token}{id}`;
      }
      return `${token}-{id}`;
    });
}

/**
 * Lista IDs lógicos (ex.: 312, 313, braco001) com base nas entidades do Orion.
 *
 * - Usa service/servicePath da config.
 * - Usa entityPrefixes como templates para mapear IDs de entidade -> logicalId.
 */
export async function fetchOrionMachineIds(orionConfig = {}) {
  const headers = buildHeaders(orionConfig);
  const templates = parseEntityTemplates(orionConfig.entityPrefixes);
  const logicalIds = new Set();

  const resp = await fetch("/v2/entities?options=keyValues", { headers });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Orion error ${resp.status}: ${text || resp.statusText}`
    );
  }

  const entities = await resp.json();

  if (!Array.isArray(entities)) {
    return [];
  }

  // Se não houver templates, devolvemos ids completos (fallback)
  if (!templates.length) {
    entities.forEach((e) => {
      if (e && e.id) logicalIds.add(e.id);
    });
    return Array.from(logicalIds);
  }

  // Caso normal: usar templates com {id}
  for (const ent of entities) {
    if (!ent || !ent.id) continue;
    const entityId = ent.id;

    for (const tmpl of templates) {
      const [prefix, suffix] = tmpl.split("{id}");
      if (
        entityId.startsWith(prefix) &&
        entityId.endsWith(suffix)
      ) {
        const middle = entityId.slice(
          prefix.length,
          entityId.length - suffix.length
        );
        if (middle) logicalIds.add(middle);
        break; // já encontramos um template que bate certo
      }
    }
  }

  return Array.from(logicalIds);
}
