import React from "react";
import { useOrionConfig } from "../context/OrionConfigContext";

function OrionSettingsPanel({ zoneId }) {
  const { config, setConfig } = useOrionConfig(zoneId);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setConfig((prev) => ({
      ...prev,  
      [field]: value,
    }));
  };

  return (
    <div
      className="orion-settings-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: 13,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Orion settings
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 160px",
            gap: 4,
          }}
        >
          <span style={{ opacity: 0.85 }}>Fiware-Service</span>
          <input
            type="text"
            value={config.fiwareService}
            onChange={handleChange("fiwareService")}
            placeholder="ex: textileservice"
          />
        </label>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 160px",
            gap: 4,
          }}
        >
          <span style={{ opacity: 0.85 }}>Fiware-ServicePath</span>
          <input
            type="text"
            value={config.fiwareServicePath}
            onChange={handleChange("fiwareServicePath")}
            placeholder="ex: /textile"
          />
        </label>
      </div>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 4,
        }}
      >
        <span style={{ opacity: 0.85 }}>
          Entity prefixes{" "}
          <span style={{ opacity: 0.7 }}>(comma separated)</span>
        </span>
        <input
          type="text"
          value={config.entityPrefixes}
          onChange={handleChange("entityPrefixes")}
          placeholder="ex: emeter, gmeter, dmeter, braco"
        />
      </label>
    </div>
  );
}

export default OrionSettingsPanel;
