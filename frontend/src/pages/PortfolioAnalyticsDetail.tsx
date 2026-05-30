import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import PortfolioMutualFund from "../screens/PortfolioMutualFund";
import PortfolioGrid from "../screens/PortfolioGrid";
import PortfolioSpread from "../screens/PortfolioSpread";

// Types for portfolio data to detect port_type
interface PortfolioType {
  portfolio_id: number;
  portfolio_name: string;
  port_type: string;
}

// Layout type detection
type AnalyticsLayout = "spread" | "grid" | "managed-fund";

export default function PortfolioAnalyticsDetail() {
  const { portfolio_id } = useParams<{ portfolio_id: string }>();
  const [layoutType, setLayoutType] = useState<AnalyticsLayout>("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolio_id) return;

    const fetchPortfolioType = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/portfolios/${portfolio_id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: PortfolioType = await response.json();
        
        // Detect layout type from port_type
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
        // Default to grid on error
        setLayoutType("grid");
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioType();
  }, [portfolio_id]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Loading layout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Link to="/analytics" className="text-accent hover:underline text-sm">
            ← Back to Analytics Dashboard
          </Link>
        </div>
        <p className="text-red-500">Error: {error}</p>
        <p className="text-gray-500 mt-2">Showing default Grid layout.</p>
      </div>
    );
  }

  // Route to appropriate layout component based on port_type
  switch (layoutType) {
    case "spread":
      return <PortfolioSpread />;
    case "managed-fund":
      return <PortfolioMutualFund portfolioId={portfolio_id} />;
    case "grid":
    default:
      return <PortfolioGrid />;
  }
}