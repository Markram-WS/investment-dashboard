import React, { useState } from 'react';
import { api } from '../../lib/api';
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
} from './controlStyles';

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
        className="min-h-[100px] cursor-pointer text-[length:var(--fs-content)]"
        style={{ color: 'var(--color-ink)' }}
        onClick={() => setEditing(true)}
      >
        {(tradePlanMd || content) ? (
          <div
            className="text-[length:var(--fs-content)]"
            style={{ color: 'var(--color-ink)' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(tradePlanMd || content) }}
          />
        ) : (
          <p className="italic text-[length:var(--fs-content)]" style={{ color: 'var(--color-slate)', margin: 0 }}>Click to add trade plan...</p>
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
        className="w-full resize-none rounded-md p-2 outline-none focus:ring-2 focus:ring-brand-yellow min-h-[120px] text-[length:var(--fs-content)]"
        style={{ background: 'transparent', color: 'var(--color-ink)' }}
        placeholder="Write your trade plan in markdown..."
        autoFocus
      />
      <div className="flex justify-end" style={{ gap: 8, marginTop: 8 }}>
        <button
          onClick={() => { setContent(tradePlanMd || ''); setEditing(false); }}
          className="hover:bg-surface-soft transition-colors"
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
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
