import React, { useState, useRef, useEffect } from 'react';
import { GroupOption } from '../../types';

interface GroupComboboxProps {
  groups: GroupOption[];
  value: number | null;
  onChange: (groupId: number | null) => void;
}

export const GroupCombobox: React.FC<GroupComboboxProps> = ({ groups, value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = groups.find(g => g.id === value);

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        className="w-full border rounded px-3 py-2 text-sm flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <span className={value ? '' : 'text-slate'}>
          {selected
            ? `${selected.name}${selected.min_price != null && selected.max_price != null ? ` ($${selected.min_price.toLocaleString()}-$${selected.max_price.toLocaleString()})` : ''}`
            : '-- No Group --'}
        </span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-canvas border rounded shadow-lg max-h-60 overflow-auto">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter..."
            className="w-full px-3 py-2 text-sm border-b outline-none"
          />
          <div
            className="px-3 py-2 text-sm text-slate hover:bg-surface cursor-pointer"
            onClick={() => { onChange(null); setOpen(false); setQuery(''); }}
          >
            -- No Group --
          </div>
          {filtered.map(g => (
            <div
              key={g.id}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-surface ${g.id === value ? 'font-bold bg-surface-soft' : ''}`}
              onClick={() => { onChange(g.id); setOpen(false); setQuery(''); }}
            >
              <span>{g.name}</span>
              {g.min_price != null && g.max_price != null && (
                <span className="text-slate ml-2">(${g.min_price.toLocaleString()}-${g.max_price.toLocaleString()})</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate">No groups found</div>
          )}
        </div>
      )}
    </div>
  );
};