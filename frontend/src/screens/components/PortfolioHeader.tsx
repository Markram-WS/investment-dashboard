import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader";

interface PortfolioHeaderProps {
  portfolioName: string;
  lastUpdated: Date;
  onRefresh: () => void;
}

const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
  portfolioName, lastUpdated, onRefresh,
}) => (
  <>
    <div
      className="flex items-center gap-2 mb-2"
      style={{ fontSize: 12, fontWeight: 500, color: "var(--color-slate)" }}
    >
      <Link
        to="/"
        className="no-underline transition-colors hover:text-ink"
        style={{ color: "var(--color-slate)" }}
      >
        Portfolios
      </Link>
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span style={{ color: "var(--color-ink)" }}>{portfolioName}</span>
    </div>
    <PageHeader
      title={`${portfolioName} Overview`}
      meta={
        <>
          <span style={{ fontSize: 12, color: "var(--color-slate)" }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={onRefresh}
            className="border border-hairline rounded-full hover:bg-surface transition-colors"
            style={{
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-ink)",
              cursor: "pointer",
            }}
          >
            Refresh Data
          </button>
        </>
      }
    />
  </>
);

export default React.memo(PortfolioHeader);
