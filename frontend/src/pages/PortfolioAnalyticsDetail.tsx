import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import PortfolioMutualFund from "../screens/PortfolioMutualFund";
import PortfolioGrid from "../screens/PortfolioGrid";
import PortfolioSpread from "../screens/PortfolioSpread";
import { PortfolioType, AnalyticsLayout } from "../types";

function BreadcrumbBar() {
  const { portfolio_id } = useParams<{ portfolio_id: string }>();
  return (
    <div className="pb-2">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate uppercase tracking-widest hover:text-ink transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Overview
      </Link>
      {portfolio_id && (
        <span className="text-[11px] text-slate mx-2">/</span>
      )}
      {portfolio_id && (
        <span className="text-[11px] font-bold text-ink uppercase tracking-widest">Portfolio #{portfolio_id}</span>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-surface rounded-lg w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 bg-surface rounded-xl" />
        <div className="h-28 bg-surface rounded-xl" />
        <div className="h-28 bg-surface rounded-xl" />
      </div>
      <div className="h-64 bg-surface rounded-xl" />
      <div className="h-48 bg-surface rounded-xl" />
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-4">
      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-red-600 dark:text-red-400">Failed to load portfolio</p>
        <p className="text-xs text-red-500/80 mt-1">{error}</p>
        <p className="text-[11px] text-slate mt-3">Showing default Grid layout.</p>
      </div>
    </div>
  );
}

function MissingPortfolio() {
  return (
    <div className="bg-surface rounded-xl border border-hairline p-8 text-center">
      <svg className="w-10 h-10 text-slate mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-sm font-bold text-ink">No portfolio selected</p>
      <p className="text-xs text-slate mt-1">Select a portfolio from the Portfolio Overview.</p>
    </div>
  );
}

export default function PortfolioAnalyticsDetail() {
  const { portfolio_id } = useParams<{ portfolio_id: string }>();
  const [layoutType, setLayoutType] = useState<AnalyticsLayout>("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolio_id) {
      setLoading(false);
      return;
    }

    const fetchPortfolioType = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/portfolios/${portfolio_id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: PortfolioType = await response.json();
        
        const type = data.port_type?.toLowerCase() || "";
        if (type.includes("spread")) {
          setLayoutType("spread");
        } else if (type.includes("managed")) {
          setLayoutType("managed-fund");
        } else {
          setLayoutType("grid");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLayoutType("grid");
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioType();
  }, [portfolio_id]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6">
      <BreadcrumbBar />
      {!portfolio_id && <MissingPortfolio />}
      {loading && <LoadingSkeleton />}
      {error && (
        <>
          <ErrorState error={error} />
          <PortfolioGrid portfolioId={portfolio_id!} />
        </>
      )}
      {portfolio_id && !loading && !error && (
        <>
          {layoutType === "spread" && <PortfolioSpread portfolioId={portfolio_id} />}
          {layoutType === "managed-fund" && <PortfolioMutualFund portfolioId={portfolio_id} />}
          {layoutType === "grid" && <PortfolioGrid portfolioId={portfolio_id} />}
        </>
      )}
    </div>
  );
}