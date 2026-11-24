import React, { useState } from "react";
import { api } from "../../lib/api";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
} from "./controlStyles";

interface StrategyNotesProps {
  internalNotes: string | null;
  /** Existing trade-plan text shown only until the first notes save. */
  tradePlanMd: string | null;
  portfolioId: number;
  onSaved: () => void;
}

const StrategyNotes: React.FC<StrategyNotesProps> = ({
  internalNotes, tradePlanMd, portfolioId, onSaved,
}) => {
  const seed = internalNotes || tradePlanMd || "";
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(seed);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setContent(internalNotes || tradePlanMd || "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePortfolio(portfolioId, { internal_notes: content });
      setEditing(false);
      onSaved();
    } catch (err) {
      console.error("Failed to save notes:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="at-card at-notes-card">
      <h3
        style={{
          margin: 0,
          fontSize: "var(--fs-label)",
          fontWeight: 500,
          color: "var(--color-slate)",
        }}
      >
        Notes
      </h3>
      {editing ? (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={saving}
            autoFocus
            placeholder="Type your observation..."
            className="w-full resize-none rounded-md p-2 outline-none focus:ring-2 focus:ring-brand-yellow"
            style={{
              minHeight: 88,
              background: "transparent",
              color: "var(--color-ink)",
              fontSize: "var(--fs-content)",
            }}
          />
          <div className="flex justify-end" style={{ gap: 8 }}>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="hover:bg-surface-soft transition-colors disabled:opacity-50"
              style={CONTROL_BUTTON_SECONDARY}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="transition-opacity hover:opacity-90 disabled:opacity-50"
              style={CONTROL_BUTTON_PRIMARY}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </>
      ) : (
        <div
          className="w-full cursor-text whitespace-pre-wrap"
          style={{ minHeight: 24, color: "var(--color-ink)", fontSize: "var(--fs-content)" }}
          onClick={startEditing}
        >
          {seed || (
            <span className="italic" style={{ color: "var(--color-slate)" }}>
              Click to add notes...
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StrategyNotes;
