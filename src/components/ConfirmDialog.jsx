import React from "react";
import Modal from "./Modal";
import "./ConfirmDialog.css"; 

export default function ConfirmDialog({
  open,
  title = "Remove machine",
  message,
  confirmText = "Remove",
  cancelText = "Cancel",
  tone = "danger", // "danger" | "default"
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div className="confirm-dialog">
        <div className="confirm-header">
          <span
            className={`confirm-icon ${tone === "danger" ? "confirm-icon--danger" : ""}`}
            aria-hidden
          >
            🗑️
          </span>
          <h3 className="confirm-title">{title}</h3>
        </div>

        {message && <p className="confirm-message" dangerouslySetInnerHTML={{ __html: message }} />}

        <div className="confirm-actions">
          <button className="btn btn--ghost" onClick={onCancel} autoFocus>
            {cancelText}
          </button>
          <button
            className={`btn ${tone === "danger" ? "btn--danger" : "btn--solid"}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
