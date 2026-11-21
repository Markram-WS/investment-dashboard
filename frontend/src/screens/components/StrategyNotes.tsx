import React, { useState } from "react";
import { api } from "../../lib/api";
import { TradePlanView } from "./TradePlanView";
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
} from "./controlStyles";

interface StrategyNotesProps {
  tradePlanMd: string | null;
  portfolioId: number;
  renderMarkdown: (content: string) => string;
  internalNotes: string | null;
  onSaved: () => void;
}

const LABEL: React.CSSProperties = { fontWeight: 500, color: "var(--color-slate)", margin: 0 };

const StrategyNotes: React.FC<StrategyNotesProps> = ({
  tradePlanMd, portfolioId, renderMarkdown, internalNotes, onSaved,
}) => {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState(internalNotes || "");
  const [savingNotes, setSavingNotes] = useState(false);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.updatePortfolio(portfolioId, { internal_notes: notesContent });
      setEditingNotes(false);
      onSaved();
    } catch (err) {
      console.error("Failed to save notes:", err);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div
      className="col-span-12 lg:col-span-4 flex flex-col"
      style={{ background: "var(--color-yellow-light)", borderRadius: 16, padding: 24 }}
    >
      <h3 className="text-[length:var(--fs-label)]" style={{ ...LABEL, marginBottom: 16 }}>Strategy &amp; notes</h3>
      <div className="flex flex-col" style={{ gap: 16 }}>
        <div>
          <span className="text-[length:var(--fs-label)]" style={LABEL}>Primary strategy</span>
          <div style={{ marginTop: 8 }}>
            <TradePlanView
              tradePlanMd={tradePlanMd}
              renderMarkdown={renderMarkdown}
              portfolioId={portfolioId}
              onSaved={onSaved}
            />
          </div>
        </div>
        <div style={{ paddingTop: 16, borderTop: "1px solid var(--color-hairline)" }}>
          <label className="text-[length:var(--fs-label)]" style={{ ...LABEL, display: "block", marginBottom: 8 }}>Internal notes</label>
          {editingNotes ? (
            <div>
              <textarea
                value={notesContent}
                onChange={(e) => setNotesContent(e.target.value)}
                className="w-full h-32 resize-none rounded-md p-2 outline-none focus:ring-2 focus:ring-brand-yellow text-[length:var(--fs-content)]"
                style={{ background: "transparent", color: "var(--color-ink)" }}
                placeholder="Type your observation..."
                autoFocus
              />
              <div className="flex justify-end" style={{ gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => setEditingNotes(false)}
                  className="hover:bg-surface-soft transition-colors"
                  style={CONTROL_BUTTON_SECONDARY}
                >
                  Cancel
                </button>
                <button onClick={handleSaveNotes} disabled={savingNotes}
                  className="transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={CONTROL_BUTTON_PRIMARY}>
                  {savingNotes ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="w-full min-h-[80px] cursor-pointer text-[length:var(--fs-content)]"
              style={{ color: "var(--color-ink)" }}
              onClick={() => { setNotesContent(internalNotes || ""); setEditingNotes(true); }}
            >
              {internalNotes ? (
                <p className="whitespace-pre-wrap text-[length:var(--fs-content)]" style={{ color: "var(--color-ink)", margin: 0 }}>{internalNotes}</p>
              ) : (
                <p className="italic text-[length:var(--fs-content)]" style={{ color: "var(--color-slate)", margin: 0 }}>Click to add notes...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyNotes;
