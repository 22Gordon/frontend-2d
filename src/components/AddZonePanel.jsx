import React, { useState } from "react";
import { upsertZone } from "../utils/layoutStore";
import "./AddZonePanel.css";

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
    if (!id) return setError("Please provide a zone ID (e.g., Z1).");
    if (!file) return setError("Please choose a PNG/JPG image.");

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
      setError("Could not read the image. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="az-form">
      <label className="az-field">
        <span>Zone ID</span>
        <input
          className="az-input"
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          placeholder="e.g., Z1"
        />
      </label>

      <label className="az-field">
        <span>Image (PNG/JPG)</span>
        <input
          className="az-file"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>

      {error && <p className="az-error">{error}</p>}

      <div className="az-actions">
        <button type="button" className="btn btn-danger btn-sm" onClick={() => onClose?.(false)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm">
          Create zone
        </button>
      </div>
    </form>
  );
}
