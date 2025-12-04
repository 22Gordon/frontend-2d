// src/context/OrionConfigContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

const OrionConfigContext = createContext(null);

// Config "base" para qualquer zona nova
const DEFAULT_ZONE_CONFIG = {
  fiwareService: "textileservice",
  fiwareServicePath: "/textile",
  entityPrefixes: "emeter, gmeter, dmeter",
};

export function OrionConfigProvider({ children }) {
  const [configsByZone, setConfigsByZone] = useState(() => {
    try {
      const saved = localStorage.getItem("orionConfigByZone");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.warn("Erro a carregar orionConfigByZone do localStorage:", err);
    }

    // chave especial _default para novas zonas
    return {
      _default: DEFAULT_ZONE_CONFIG,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem("orionConfigByZone", JSON.stringify(configsByZone));
    } catch (err) {
      console.warn("Erro a guardar orionConfigByZone no localStorage:", err);
    }
  }, [configsByZone]);

  return (
    <OrionConfigContext.Provider value={{ configsByZone, setConfigsByZone }}>
      {children}
    </OrionConfigContext.Provider>
  );
}

/**
 * Hook para obter/alterar config de uma zona específica.
 * Se a zona ainda não tiver config própria, usa _default.
 */
export function useOrionConfig(zoneId) {
  const ctx = useContext(OrionConfigContext);
  if (!ctx) {
    throw new Error("useOrionConfig deve ser usado dentro de OrionConfigProvider");
  }

  const { configsByZone, setConfigsByZone } = ctx;
  const key = zoneId || "_default";

  const config =
    configsByZone[key] ||
    configsByZone._default ||
    DEFAULT_ZONE_CONFIG;

  const setConfig = (updater) => {
    setConfigsByZone((prev) => {
      const prevConfig =
        prev[key] ||
        prev._default ||
        DEFAULT_ZONE_CONFIG;

      const nextConfig =
        typeof updater === "function" ? updater(prevConfig) : updater;

      return {
        ...prev,
        [key]: nextConfig,
      };
    });
  };

  return { config, setConfig };
}
