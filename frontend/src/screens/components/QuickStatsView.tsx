import React from 'react';
import { PortfolioData } from '../../types';

interface QuickStatsViewProps {
  portfolio: PortfolioData;
}

export const QuickStatsView: React.FC<QuickStatsViewProps> = ({ portfolio }) => {
  return (
    <div className="bg-yellow-100 p-3 rounded shadow mb-4">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Active Pairs:</span>
          <span className="font-medium ml-1">{portfolio.spread_pairs?.length || 0}</span>
        </div>
        <div>
          <span className="text-gray-500">Positions:</span>
          <span className="font-medium ml-1">{portfolio.active_orders?.length || 0}</span>
        </div>
      </div>
    </div>
  );
};