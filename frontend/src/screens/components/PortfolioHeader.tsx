import React from "react";

interface PortfolioHeaderProps {
  portfolioName: string;
  lastUpdated: Date;
  onRefresh: () => void;
  onAddOrder: () => void;
}

const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
  portfolioName, lastUpdated, onRefresh, onAddOrder,
}) => (
  <header className="flex justify-between items-center w-full mb-6">
    <div className="flex flex-col">
      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
        <span>Portfolios</span>
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-ink">{portfolioName}</span>
      </div>
      <h2 className="text-3xl font-bold tight-headline">{portfolioName} Overview</h2>
      <p className="text-slate text-xs mt-1">Updated {lastUpdated.toLocaleTimeString()}</p>
    </div>
    <div className="flex items-center gap-3">
      <button
        onClick={onRefresh}
        className="px-4 py-2 text-xs font-bold border border-hairline rounded-full hover:bg-surface transition-colors uppercase tracking-wider"
      >
        Refresh Data
      </button>
      <button
        onClick={onAddOrder}
        className="h-11 w-11 rounded-full bg-brand-teal text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        title="Add Order"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  </header>
);

export default PortfolioHeader;
