import React, { useState } from 'react';
import { api } from '../../lib/api';

interface TradePlanViewProps {
  tradePlanMd: string | null;
  renderMarkdown: (content: string) => string;
  portfolioId?: number;
  onSaved?: () => void;
}

export const TradePlanView: React.FC<TradePlanViewProps> = ({ tradePlanMd, renderMarkdown, portfolioId, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(tradePlanMd || '');
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div
        className="bg-yellow-100 p-3 rounded mb-4 min-h-[100px] cursor-pointer hover:bg-yellow-200/80 transition-colors border border-yellow-300"
        onClick={() => setEditing(true)}
      >
        {(tradePlanMd || content) ? (
          <div
            className="text-sm text-gray-700 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(tradePlanMd || content) }}
          />
        ) : (
          <p className="text-sm text-gray-400 italic">Click to add trade plan...</p>
        )}
      </div>
    );
  }

  const handleSave = async () => {
    if (!portfolioId) return;
    setSaving(true);
    try {
      await api.updatePortfolio(portfolioId, { trade_plan_md: content });
      setEditing(false);
      onSaved?.();
    } catch (err) {
      console.error('Failed to save trade plan:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-yellow-100 p-3 rounded mb-4 border border-yellow-300">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full bg-transparent text-sm text-gray-700 resize-none focus:outline-none min-h-[120px]"
        placeholder="Write your trade plan in markdown..."
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={() => { setContent(tradePlanMd || ''); setEditing(false); }}
          className="px-3 py-1 text-xs border rounded hover:bg-white/50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 text-xs bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
