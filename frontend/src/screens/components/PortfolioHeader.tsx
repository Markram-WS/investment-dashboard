import React from "react";
import { Link } from "react-router-dom";

interface PortfolioHeaderProps {
  portfolioName: string;
  portType: string;
  tags?: Record<string, boolean> | null;
  lastUpdated: Date;
  onRefresh: () => void;
  onEditPortfolio: () => void;
  /** Custom portfolios only: opens the mapping admin modal. */
  showConnection?: boolean;
  onOpenConnection?: () => void;
}

/** 44px header band: breadcrumb + title on the left, pool actions on the right. */
const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
  portfolioName, portType, tags, lastUpdated, onRefresh, onEditPortfolio,
  showConnection = false, onOpenConnection,
}) => (
  <header className="at-head">
    <div style={{ minWidth: 0 }}>
      <div className="at-crumb">
        <Link to="/">Portfolios</Link>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--color-ink)" }}>{portfolioName}</span>
      </div>
      <h1 className="at-h1">{portfolioName} Overview</h1>
    </div>

    <div className="at-head-meta">
      <span className="at-tag">{portType}</span>
      {Object.entries(tags ?? {})
        .filter(([, on]) => on)
        .map(([name]) => (
          <span className="at-tag at-hide-narrow" key={name}>
            {name}
          </span>
        ))}
      <span className="at-num">Updated {lastUpdated.toLocaleTimeString()}</span>
      {showConnection && onOpenConnection && (
        <button type="button" className="at-btn-ghost" onClick={onOpenConnection}>
          Connection
        </button>
      )}
      <button type="button" className="at-btn-ghost" onClick={onEditPortfolio}>
        Edit pool
      </button>
      <button type="button" className="at-btn" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  </header>
);

export default React.memo(PortfolioHeader);
