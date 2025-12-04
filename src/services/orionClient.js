// src/services/orionClient.js

const DEFAULT_ORION_CONFIG = {
  fiwareService: "textileservice",
  fiwareServicePath: "/textile",
  entityPrefixes: "emeter, gmeter, dmeter", // compatível com o que tens hoje
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
 *   "emeter, gmeter"         -> ["emeter-{id}", "gmeter-{id}"]
 *   "RoboticArm:,Gripper:"   -> ["RoboticArm:{id}", "Gripper:{id}"]
 *   "emeter-{id}"            -> ["emeter-{id}"]
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
      // Se já traz {id}, respeitamos
      if (token.includes("{id}")) return token;

      // Se termina com -, :, _ assumimos que já inclui o separador
      if (token.endsWith("-") || token.endsWith(":") || token.endsWith("_")) {
        return `${token}{id}`;
      }

      // Caso base (compatível com Adalberto): prefixo simples -> prefixo-{id}
      return `${token}-{id}`;
    });
}

/**
 * Busca dados das entidades associadas a um "logicalId" (machineId, robotId, etc.).
 * Junta tudo num único objeto de atributos.
 *
 * @param {string|number} logicalId   ex.: 312, "braco001"
 * @param {object} orionConfig        { fiwareService, fiwareServicePath, entityPrefixes }
 */
export async function getMachineDataFromOrion(logicalId, orionConfig = {}) {
  const headers = buildHeaders(orionConfig);
  const templates = parseEntityTemplates(orionConfig.entityPrefixes);

  const data = {};

  for (const tmpl of templates) {
    const entityId = tmpl.replace("{id}", logicalId);

    try {
      const response = await fetch(
        `/v2/entities/${encodeURIComponent(entityId)}`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // entidade não existe -> ignora
        } else {
          console.warn(
            `Erro ao obter dados da entidade ${entityId}:`,
            response.status,
            await response.text()
          );
        }
        continue;
      }

      const entityData = await response.json();

      Object.entries(entityData).forEach(([key, value]) => {
        if (key !== "id" && key !== "type") {
          // último a chegar ganha se houver conflitos de nome
          data[key] = value;
        }
      });
    } catch (err) {
      console.error(`Erro ao obter dados da entidade ${entityId}:`, err);
    }
  }

  return Object.keys(data).length > 0 ? data : null;
}
