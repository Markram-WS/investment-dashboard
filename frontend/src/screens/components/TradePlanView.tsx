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
        className="min-h-[100px] cursor-pointer"
        style={{ fontSize: 15, color: 'var(--color-ink)' }}
        onClick={() => setEditing(true)}
      >
        {(tradePlanMd || content) ? (
          <div
            style={{ fontSize: 15, color: 'var(--color-ink)' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(tradePlanMd || content) }}
          />
        ) : (
          <p className="italic" style={{ fontSize: 15, color: 'var(--color-slate)', margin: 0 }}>Click to add trade plan...</p>
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
    <div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full resize-none rounded-md p-2 outline-none focus:ring-2 focus:ring-brand-yellow min-h-[120px]"
        style={{ background: 'transparent', fontSize: 15, color: 'var(--color-ink)' }}
        placeholder="Write your trade plan in markdown..."
        autoFocus
      />
      <div className="flex justify-end" style={{ gap: 8, marginTop: 8 }}>
        <button
          onClick={() => { setContent(tradePlanMd || ''); setEditing(false); }}
          className="rounded-full hover:bg-surface-soft transition-colors"
          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--color-slate)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, background: 'var(--color-ink)', color: 'var(--color-canvas)' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
