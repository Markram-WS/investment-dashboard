import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDrag, useDrop } from 'react-dnd';
import { api } from '../lib/api';
import { useNotification } from '../contexts/NotificationContext';
import PageLayout from '../components/PageLayout';
import Button from '../screens/components/Button';
import AddAssetModal from '../screens/AddAssetModal';
import EditAssetModal from '../screens/EditAssetModal';
import AssetGroupModal from '../screens/AssetGroupModal';

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'stock', label: 'Stock' },
  { value: 'future', label: 'Future' },
  { value: 'option', label: 'Option' },
  { value: 'crypto', label: 'Crypto' },
];

const ITEM_TYPE = 'ASSET_ROW';

function DraggableRow({ asset, onEdit, onRefreshPrice, onSavePrice }: { asset: any; onEdit: (a: any) => void; onRefreshPrice?: (asset: any) => void; onSavePrice?: (asset: any, price: number) => void }) {
  const cachedPrice = localStorage.getItem(`cached_price_${asset.ticker}`);
  const displayPrice = (asset.price && asset.price > 0)
    ? asset.price
    : (cachedPrice ? parseFloat(cachedPrice) : asset.price);
  const change = asset.change_24h;
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');

  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: ITEM_TYPE,
    item: { assetId: asset.asset_id, groupId: asset.group_id },
    collect: (m) => ({ isDragging: m.isDragging() }),
  }), [asset.asset_id, asset.group_id]);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshing || !onRefreshPrice) return;
    setRefreshing(true);
    await onRefreshPrice(asset);
    setRefreshing(false);
  };

  const startEdit = () => {
    setEditVal(String(displayPrice ?? 0));
    setEditing(true);
  };

  const commitPrice = async () => {
    setEditing(false);
    const num = parseFloat(editVal);
    if (isNaN(num) || num <= 0 || !onSavePrice) return;
    localStorage.setItem(`cached_price_${asset.ticker}`, String(num));
    await onSavePrice(asset, num);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitPrice();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <tr ref={dragRef} className={`border-t border-hairline hover:bg-surface transition-colors ${isDragging ? 'opacity-40' : ''}`}>
      <td className="px-4 py-3 text-sm font-semibold text-ink">{asset.ticker}</td>
      <td className="px-4 py-3 text-sm text-slate">{asset.name || '—'}</td>
      <td className="px-4 py-3 text-sm text-right text-ink font-medium cursor-pointer" onClick={startEdit}>
        {editing ? (
          <input type="number" step="any" value={editVal} autoFocus
            onChange={e => setEditVal(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={handleKeyDown}
            className="w-28 text-right text-sm border border-brand-teal rounded px-2 py-0.5 bg-canvas text-ink outline-none"
            onClick={e => e.stopPropagation()} />
        ) : (
          displayPrice != null ? `$${Number(displayPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
        )}
      </td>
      <td className={`px-4 py-3 text-sm text-right font-medium ${change != null ? (change >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-slate'}`}>
        {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-slate">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${asset.source === 'yfinance' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
          {asset.source}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {asset.source === 'yfinance' && (
            <button onClick={handleRefresh} disabled={refreshing}
              className="text-slate hover:text-brand-teal transition-colors p-1" title="Refresh price">
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          )}
          <button onClick={() => onEdit(asset)}
            className="text-slate hover:text-ink transition-colors p-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

function GroupSection({ groupId, groupName, assets, onEdit, onDrop, onRefreshPrice, onSavePrice }: {
  groupId: number | null;
  groupName: string;
  assets: any[];
  onEdit: (a: any) => void;
  onDrop: (assetId: number) => void;
  onRefreshPrice?: (asset: any) => void;
  onSavePrice?: (asset: any, price: number) => void;
}) {
  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: ITEM_TYPE,
    drop: (item: any) => {
      if (item.groupId === groupId) return;
      onDrop(item.assetId);
    },
    collect: (m) => ({ isOver: m.isOver() }),
  }), [groupId]);

  const [collapsed, setCollapsed] = useState(false);

  return (
    <section ref={dropRef} className={`bg-canvas rounded-xl border border-hairline overflow-hidden transition-shadow ${isOver ? 'shadow-[0_0_0_2px_rgba(15,188,176,0.5)]' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-hairline">
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(c => !c)} className="text-slate hover:text-ink transition-colors">
            <svg className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <h3 className="text-sm font-bold text-ink">{groupName}</h3>
          <span className="text-[10px] text-slate bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full font-medium">{assets.length}</span>
        </div>
      </div>
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-hairline">
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate uppercase tracking-widest">Symbol</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate uppercase tracking-widest">Name</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate uppercase tracking-widest text-right">Price</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate uppercase tracking-widest text-right">Change 24h</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate uppercase tracking-widest">Source</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate text-xs">No assets in this group</td>
                </tr>
              ) : (
                assets.map((asset: any) => (
                  <DraggableRow key={asset.asset_id} asset={asset} onEdit={onEdit} onRefreshPrice={onRefreshPrice} onSavePrice={onSavePrice} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AllAssets() {
  const [typeFilter, setTypeFilter] = useState('');
  const [refreshMode, setRefreshMode] = useState<'manual' | 'auto'>(() => {
    return (localStorage.getItem('asset_refresh_mode') as 'manual' | 'auto') || 'manual';
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editAsset, setEditAsset] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const { notify } = useNotification();
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: groups = [], refetch: refetchGroups } = useQuery({
    queryKey: ['asset-groups'],
    queryFn: () => api.getAssetGroups(),
  });

  const { data: assets = [], refetch: refetchAssets } = useQuery({
    queryKey: ['assets', typeFilter],
    queryFn: () => api.getAssets({ asset_type: typeFilter || undefined }),
  });

  const refetchAll = useCallback(async () => {
    try {
      const result = await api.batchUpdatePrices();
      await refetchAssets();
      const fresh = await api.getAssets({ asset_type: typeFilter || undefined });
      for (const a of fresh) {
        if (a.price && a.price > 0) {
          localStorage.setItem(`cached_price_${a.ticker}`, String(a.price));
        }
      }
      if (result.updated > 0) {
        notify(`Updated ${result.updated} prices`, 'success');
      } else {
        notify('No prices updated — all assets may be rate limited', 'warning');
      }
    } catch (e: any) {
      notify(e.message || 'Failed to refresh prices', 'warning');
    }
  }, [refetchAssets, typeFilter]);

  const handleRefreshPrice = async (asset: any) => {
    try {
      const updated = await api.updateAssetPrice(asset.asset_id);
      if (updated.price && updated.price > 0) {
        localStorage.setItem(`cached_price_${updated.ticker}`, String(updated.price));
      }
      notify(`${asset.ticker} price updated`, 'success');
      await refetchAssets();
    } catch (e: any) {
      notify(`${asset.ticker}: ${e.message || 'refresh failed'}`, 'warning');
    }
  };

  const handleSavePrice = async (asset: any, price: number) => {
    try {
      if (asset.source === 'yfinance') {
        await api.updateAsset(asset.asset_id, { price });
      }
      localStorage.setItem(`cached_price_${asset.ticker}`, String(price));
      await refetchAssets();
    } catch (e: any) {
      notify(`${asset.ticker}: ${e.message || 'save failed'}`, 'warning');
    }
  };

  useEffect(() => {
    localStorage.setItem('asset_refresh_mode', refreshMode);
    if (refreshMode === 'auto') {
      autoTimerRef.current = setInterval(refetchAll, 600000);
      return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
    } else {
      if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
    }
  }, [refreshMode, refetchAll]);

  // Auto-sync symbols from all portfolios on page load
  useEffect(() => {
    (async () => {
      try {
        await api.syncAllAssets();
        await refetchAssets();
      } catch {
        // silent — non-critical
      }
    })();
  }, []);

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const created = await api.syncAllAssets();
      notify(`Synced ${created.length} new assets from orders`, 'success');
      await refetchAssets();
    } catch (e: any) {
      notify(e.message || 'Sync failed', 'warning');
    }
    setSyncLoading(false);
  };

  const handleDrop = async (assetId: number, targetGroupId: number | null) => {
    try {
      await api.updateAsset(assetId, { group_id: targetGroupId });
      await refetchAssets();
    } catch (e: any) {
      notify(e.message || 'Failed to move asset', 'warning');
    }
  };

  const sections = useMemo(() => {
    const ungroupedGroup = groups.find(g => g.name === 'Ungrouped');
    const ungroupedId = ungroupedGroup ? ungroupedGroup.id : null;

    const map: Record<string, any[]> = {};
    for (const g of groups) {
      map[`group_${g.id}`] = [];
    }
    if (ungroupedId == null) map.ungrouped = [];

    for (const a of assets) {
      if (a.group_id != null) {
        const key = `group_${a.group_id}`;
        if (map[key]) map[key].push(a);
        else map[key] = [a];
      } else if (ungroupedId != null) {
        map[`group_${ungroupedId}`].push(a);
      } else {
        map.ungrouped.push(a);
      }
    }

    const result: { groupId: number | null; groupName: string; assets: any[] }[] = [];

    for (const g of groups) {
      const key = `group_${g.id}`;
      result.push({ groupId: g.id, groupName: g.name, assets: map[key] || [] });
    }

    if (ungroupedId == null) {
      result.push({ groupId: null, groupName: 'Ungrouped', assets: map.ungrouped || [] });
    }

    return result;
  }, [assets, groups]);

  return (
      <PageLayout>

        <AddAssetModal open={showAddModal} onClose={() => setShowAddModal(false)} onSaved={() => { refetchAssets(); refetchGroups(); }} groups={groups} />
        <EditAssetModal open={!!editAsset} asset={editAsset} onClose={() => setEditAsset(null)} onSaved={() => { refetchAssets(); refetchGroups(); }} groups={groups} />
        <AssetGroupModal open={showGroupModal} onClose={() => { setShowGroupModal(false); refetchAssets(); refetchGroups(); }} />

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-[22px] font-bold text-ink">Asset</h1>
          <div className="flex items-center gap-3">
            {refreshMode === 'manual' ? (
              <button onClick={refetchAll}
                className="w-9 h-9 rounded-full border border-hairline flex items-center justify-center text-slate hover:text-ink hover:bg-surface transition-all"
                title="Refresh prices">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            ) : (
              <span className="text-[10px] text-slate font-medium">Auto-refreshing every 10m</span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate font-medium uppercase tracking-wider">Auto</span>
              <button
                onClick={() => setRefreshMode(prev => prev === 'manual' ? 'auto' : 'manual')}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${refreshMode === 'auto' ? 'bg-brand-teal' : 'bg-gray-300'}`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-canvas transition-transform ${refreshMode === 'auto' ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Type tabs + action buttons */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1">
            {TYPE_TABS.map(tab => (
              <button key={tab.value} onClick={() => setTypeFilter(tab.value)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all ${typeFilter === tab.value ? 'bg-ink text-white border-ink' : 'border-hairline bg-canvas text-slate hover:border-gray-300'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGroupModal(true)}
              className="h-8 w-8 rounded-full bg-canvas text-slate border border-hairline hover:bg-surface transition-all flex items-center justify-center"
              title="Asset Groups">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <Button variant="secondary" onClick={handleSync} disabled={syncLoading}>
              {syncLoading ? 'Syncing...' : 'Sync from Orders'}
            </Button>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>+ Add Asset</Button>
          </div>
        </div>

        {/* Group sections */}
        <div className="space-y-4">
          {sections.map(s => (
            <GroupSection
              key={s.groupId ?? 'ungrouped'}
              groupId={s.groupId}
              groupName={s.groupName}
              assets={s.assets}
              onEdit={setEditAsset}
              onDrop={(assetId) => handleDrop(assetId, s.groupId)}
              onRefreshPrice={handleRefreshPrice}
              onSavePrice={handleSavePrice}
            />
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 text-[10px] text-slate">
          {assets.length} asset{assets.length !== 1 ? 's' : ''} · {groups.length} group{groups.length !== 1 ? 's' : ''} · {refreshMode === 'auto' ? 'Auto-refresh ON' : 'Manual refresh'}
        </div>

        {/* Symbol tips */}
        <details className="mt-2 group">
          <summary className="text-[10px] text-slate/60 hover:text-slate cursor-pointer transition-colors select-none list-none">
            <span className="inline-flex items-center gap-1">
              <svg className={`w-3 h-3 transition-transform group-open:rotate-90`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              yfinance symbol patterns
            </span>
          </summary>
          <div className="mt-2 p-3 rounded-lg border border-hairline bg-surface/50 text-[10px] text-slate leading-relaxed space-y-1">
            <div className="font-semibold text-ink mb-1.5">Yahoo Finance symbol format</div>
            <div><span className="font-mono text-brand-teal">PTT.BK</span> — Thai stocks (add <span className="font-mono">.BK</span> suffix)</div>
            <div><span className="font-mono text-brand-teal">BTC-USD</span> — Crypto (ticker <span className="font-mono">-USD</span>)</div>
            <div><span className="font-mono text-brand-teal">AAPL</span> — US stocks (plain ticker)</div>
            <div><span className="font-mono text-brand-teal">6758.T</span> — Japanese stocks (add <span className="font-mono">.T</span>)</div>
            <div><span className="font-mono text-brand-teal">TSLA.US</span> — Some non-US exchanges via <span className="font-mono">.US</span></div>
            <div className="mt-1.5 pt-1.5 border-t border-hairline text-slate/50">Enter the symbol exactly as Yahoo Finance expects it when creating an asset with source=yfinance.</div>
          </div>
        </details>
      </PageLayout>
  );
}
