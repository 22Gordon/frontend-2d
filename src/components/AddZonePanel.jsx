import React, { useState } from "react";
import { upsertZone } from "../utils/layoutStore";

export default function AddZonePanel({ onClose }) {
  const [zoneId, setZoneId] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  async function fileToDataURL(f) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function getImageSize(dataUrl) {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const id = zoneId.trim();
    if (!id) return setError("Indica um ID para a zona (ex.: Z1).");
    if (!file) return setError("Escolhe uma imagem PNG / JPG.");

    try {
      const dataUrl = await fileToDataURL(file);
      const { width, height } = await getImageSize(dataUrl);

      upsertZone(id, {
        image: String(dataUrl),
        baseWidth: width,
        baseHeight: height,
        machines: {}
      });

      onClose?.(true);
    } catch (err) {
      console.error(err);
      setError("Falha ao ler a imagem. Tenta novamente.");
    }
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
      <h3 style={{ marginTop: 0 }}>Adicionar zona</h3>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>ID da zona</span>
          <input value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder="ex.: Z1" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Imagem (PNG/JPG)</span>
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => onClose?.(false)}>Cancelar</button>
          <button type="submit">Criar zona</button>
        </div>
      </form>
    </div>
  );
}
