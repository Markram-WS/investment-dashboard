import React from 'react';
import { PortfolioData } from '../../types';

interface TradePlanViewProps {
  tradePlanMd: string | null;
  renderMarkdown: (content: string) => string;
}

export const TradePlanView: React.FC<TradePlanViewProps> = ({ tradePlanMd, renderMarkdown }) => {
  return (
    <div className="bg-yellow-100 p-3 rounded shadow mb-4">
      {tradePlanMd ? (
        <div
          className="text-sm text-gray-700 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(tradePlanMd) }}
        />
      ) : (
        <p className="text-sm text-gray-500">No trade plan available</p>
      )}
    </div>
  );
};