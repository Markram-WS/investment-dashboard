import React, { useState } from 'react';
import { RecentTrade } from '../../types';

interface HistoricalGridViewProps {
  recentTrades: RecentTrade[];
}

export const HistoricalGridView: React.FC<HistoricalGridViewProps> = ({ recentTrades }) => {
  const [showHistorical, setShowHistorical] = useState(false);

  if (!recentTrades || recentTrades.length === 0) {
    return null;
  }

  return (
    <div className="p-3 border-t border-yellow-200">
      <button
        onClick={() => setShowHistorical(!showHistorical)}
        className="w-full flex justify-between items-center font-semibold mb-2 text-gray-700"
      >
        <span>Historical Grid System</span>
        <span className="text-xs">{showHistorical ? '▼' : '▶'}</span>
      </button>
      {showHistorical && (
        <div className="space-y-2 max-h-64 overflow-auto mt-2">
          {recentTrades.map((trade) => (
            <div
              key={trade.history_id}
              className="bg-yellow-100 p-2 rounded border border-yellow-200 text-xs"
            >
              <div className="flex justify-between">
                <span className="font-medium">{trade.asset} {trade.type}</span>
                <span className={trade.realized_pl && trade.realized_pl > 0 ? 'text-green-600' : 'text-red-600'}>
                  {trade.realized_pl ? `$${trade.realized_pl} P/L` : '-'}
                </span>
              </div>
              <div className="text-gray-500 mt-1">
                {trade.entry_date} → {trade.exit_date}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};