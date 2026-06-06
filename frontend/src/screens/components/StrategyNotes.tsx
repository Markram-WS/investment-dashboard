import React, { useState } from "react";
import { api } from "../../lib/api";
import { TradePlanView } from "./TradePlanView";

interface StrategyNotesProps {
  tradePlanMd: string | null;
  portfolioId: number;
  renderMarkdown: (content: string) => string;
  internalNotes: string | null;
  onSaved: () => void;
}

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
    <div className="col-span-12 lg:col-span-4 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 p-8 flex flex-col border border-hairline-soft">
      <h3 className="text-[11px] font-bold text-ink uppercase tracking-widest mb-6">Strategy & Notes</h3>
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Primary Strategy</span>
          <div className="mt-2">
            <TradePlanView
              tradePlanMd={tradePlanMd}
              renderMarkdown={renderMarkdown}
              portfolioId={portfolioId}
              onSaved={onSaved}
            />
          </div>
        </div>
        <div className="pt-6 border-t border-ink/10">
          <label className="text-[10px] font-bold text-slate block mb-2 uppercase tracking-wider">Internal Notes</label>
          {editingNotes ? (
            <div>
              <textarea
                value={notesContent}
                onChange={(e) => setNotesContent(e.target.value)}
                className="w-full h-32 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-4 text-sm focus:ring-2 focus:ring-brand-yellow outline-none resize-none"
                placeholder="Type your observation..."
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setEditingNotes(false)} className="px-3 py-1 text-xs border rounded hover:bg-white/50">Cancel</button>
                <button onClick={handleSaveNotes} disabled={savingNotes}
                  className="px-3 py-1 text-xs bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50">
                  {savingNotes ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="w-full min-h-[80px] bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-4 text-sm cursor-pointer hover:bg-yellow-200/80 transition-colors"
              onClick={() => { setNotesContent(internalNotes || ""); setEditingNotes(true); }}
            >
              {internalNotes ? (
                <p className="whitespace-pre-wrap text-sm text-gray-700">{internalNotes}</p>
              ) : (
                <p className="text-sm text-slate italic">Click to add notes...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyNotes;
