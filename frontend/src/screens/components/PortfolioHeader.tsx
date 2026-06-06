import React from "react";

interface PortfolioHeaderProps {
  portfolioName: string;
  lastUpdated: Date;
  onRefresh: () => void;
}

const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
  portfolioName, lastUpdated, onRefresh,
}) => (
  <header className="flex justify-between items-center w-full mb-6">
    <div className="flex flex-col">
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate uppercase tracking-widest mb-1">
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
    </div>
  </header>
);

export default PortfolioHeader;
