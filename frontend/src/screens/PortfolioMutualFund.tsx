import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { FundPortfolio, TradeRecommendation, RecommendResponse, NavHistoryRecord, NavHistoryResponse, TradePlan } from "../types";
import { colors, rounded, spacing } from "../constants/colors";
import { getRiskColor, getDriftColor, calculateDrift } from "../utils/risk";

interface ManagedFundProps {
  portfolioId?: string;
}

export default function ManagedFund({ portfolioId = "1" }: ManagedFundProps) {
  const [portfolio, setPortfolio] = useState<FundPortfolio | null>(null);
  const [tradePlans, setTradePlans] = useState<TradePlan[]>([]);
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [navHistory, setNavHistory] = useState<NavHistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendLoading, setRecommendLoading] = useState<boolean>(false);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>("");

  // Fetch portfolio, trade plans, and NAV history data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch basic portfolio data
        const portfolioData = await api.getPortfolio(parseInt(portfolioId));
        setPortfolio(portfolioData);
        setError(null);

        // Fetch trade plans for this portfolio
        try {
          const tradePlansData = await api.getTradePlans(parseInt(portfolioId));
          setTradePlans(tradePlansData);
        } catch {
          // Trade plans may not exist yet
        }

        // Fetch NAV history
        try {
          const navData: NavHistoryResponse = await api.getNavHistory(parseInt(portfolioId));
          setNavHistory(navData.nav_history || []);
        } catch {
          // NAV history may not exist yet
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load portfolio data.");
        // Set mock data for development
        setPortfolio({
          portfolio_id: parseInt(portfolioId),
          portfolio_name: "Managed Fund Alpha",
          port_type: "managed-fund",
          current_nav: 100000,
          margin_locked: 60000,
          available_cash: 25000,
          money_market: 15000,
          cash_buffer_limit: 20000,
          target_ratio: { BTC: 50, ETH: 30, SOL: 20 },
          current_allocations: { BTC: 45, ETH: 35, SOL: 20 },
          last_rebalance_date: "2024-01-15",
          risk_status: "Safe",
        });
        setTradePlans([{
          plan_id: 1,
          portfolio_id: parseInt(portfolioId),
          trade_plan_md: "# Rebalance Strategy\n- Target: 50% BTC, 30% ETH, 20% SOL\n- Tolerance: ±5%\n- Last rebalance: 2024-01-15",
          created_at: "2024-01-15T00:00:00Z",
          updated_at: null,
        }]);
        setNavHistory([
          { nav_id: 1, nav_date: "2024-01-20", nav_value: 102000 },
          { nav_id: 2, nav_date: "2024-01-19", nav_value: 101500 },
          { nav_id: 3, nav_date: "2024-01-18", nav_value: 101000 },
          { nav_id: 4, nav_date: "2024-01-17", nav_value: 100500 },
          { nav_id: 5, nav_date: "2024-01-16", nav_value: 100000 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portfolioId]);

  // Calculate drift for a specific asset
  const calcDrift = (symbol: string): number => {
    if (!portfolio) return 0;
    const target = portfolio.target_ratio?.[symbol] || 0;
    const current = portfolio.current_allocations?.[symbol] || 0;
    return calculateDrift(target, current);
  };

  // Handle rebalance recommendation
  const handleCalculateRebalance = async () => {
    if (!portfolio) return;
    try {
      setRecommendLoading(true);
      const data: RecommendResponse = await api.recommendRebalance({ portfolio_id: portfolio.portfolio_id });
      setRecommendations(data.recommendations);
    } catch (err) {
      console.error("Rebalance calculation failed:", err);
    } finally {
      setRecommendLoading(false);
    }
  };

  // Handle execute trades
  const handleExecuteTrades = async () => {
    if (!portfolio || recommendations.length === 0) return;
    try {
      await api.executeRebalance({
        portfolio_id: portfolio.portfolio_id,
        recommendations: recommendations,
      });
      alert("Trades executed successfully!");
      setRecommendations([]);
    } catch (err) {
      console.error("Trade execution failed:", err);
    }
  };

  // Start editing a trade plan
  const startEditPlan = (plan: TradePlan) => {
    setEditingPlanId(plan.plan_id);
    setEditContent(plan.trade_plan_md || "");
  };

  // Save edited trade plan
  const saveEditedPlan = async (planId: number) => {
    try {
      const updatedPlan = await api.updateTradePlan(planId, { trade_plan_md: editContent });
      setTradePlans(plans => plans.map(p => 
        p.plan_id === planId ? updatedPlan : p
      ));
      setEditingPlanId(null);
    } catch (err) {
      console.error("Failed to save trade plan:", err);
      alert("Failed to save trade plan");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-center mb-8">Loading Managed Fund...</h2>
      </div>
    );
  }

  if (error && !portfolio) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-center text-red-600 mb-8">Error Loading Portfolio</h2>
        <p className="text-center text-red-400">{error}</p>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold text-center mb-8">No Portfolio Data</h2>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-canvas p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-[32px] font-semibold text-ink">
            {portfolio.portfolio_name}
          </h1>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-tealLight text-brandTeal">
            Managed Fund
          </span>
        </div>
        {portfolio.last_rebalance_date && (
          <p className="text-sm text-slate">
            Last rebalanced: {portfolio.last_rebalance_date}
          </p>
        )}
      </div>

      {/* Key Metrics & Asset Allocation Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Key Metrics Card */}
        <div className="bg-tealLight rounded-xl p-xl">
          <h3 className="text-2xl font-semibold text-ink mb-4">Key Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-ink">Current NAV</p>
              <p className="text-2xl font-bold text-primary">
                ${portfolio.current_nav?.toLocaleString() || "0"}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink">Margin Locked</p>
              <p className="text-2xl font-bold text-primary">
                ${portfolio.margin_locked?.toLocaleString() || "0"}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink">Available Cash</p>
              <p className="text-2xl font-bold text-primary">
                ${portfolio.available_cash?.toLocaleString() || "0"}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink">Risk Status</p>
              <p className="text-2xl font-bold" style={{ color: getRiskColor(portfolio.risk_status) }}>
                {portfolio.risk_status || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Asset Allocation Card */}
        <div className="bg-surfaceSoft rounded-xl p-xl border border-hairline">
          <h3 className="text-2xl font-semibold text-ink mb-4">Asset Allocation</h3>
          <div className="space-y-3">
            {Object.entries(portfolio.target_ratio || {}).map(([symbol, target]) => {
              const current = portfolio.current_allocations?.[symbol] || 0;
              const drift = calcDrift(symbol);
              const driftColor = getDriftColor(drift);
              return (
                <div key={symbol}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-ink">{symbol}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate">
                        {current}% / {target}%
                      </span>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: driftColor }}
                      ></span>
                    </div>
                  </div>
                  <div className="relative h-6 bg-hairline rounded-md overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-brandTeal rounded-l-md"
                      style={{ width: `${current}%` }}
                    ></div>
                    <div
                      className="absolute top-0 h-full w-0.5 bg-ink"
                      style={{ left: `${target}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trade Plan Section */}
      <div className="bg-brandYellow bg-opacity-20 rounded-xl p-lg mb-8">
        <h3 className="text-2xl font-semibold text-ink mb-3">Trade Plans</h3>
        {tradePlans.length > 0 ? (
          <div className="space-y-4">
            {tradePlans.map((plan) => (
              <div key={plan.plan_id} className="bg-canvas rounded-md p-4 border border-hairline">
                {editingPlanId === plan.plan_id ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full h-32 p-2 border border-hairline rounded-md font-mono text-sm"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => saveEditedPlan(plan.plan_id)}
                        className="px-3 py-1 rounded-md text-sm font-medium bg-brandTeal text-onPrimary hover:bg-tealLight"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPlanId(null)}
                        className="px-3 py-1 rounded-md text-sm font-medium bg-surface text-ink border border-hairline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <pre className="whitespace-pre-wrap text-sm text-ink font-mono">
                      {plan.trade_plan_md || "No content"}
                    </pre>
                    <button
                      onClick={() => startEditPlan(plan)}
                      className="mt-2 text-xs text-brandTeal hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate italic">No trade plans defined</p>
        )}
      </div>

      {/* Rebalance Controls */}
      <div className="bg-surfaceSoft rounded-xl p-lg mb-8">
        <h3 className="text-2xl font-semibold text-ink mb-4">Rebalance Actions</h3>
        <div className="flex space-x-4 mb-4">
          <button
            onClick={handleCalculateRebalance}
            disabled={recommendLoading}
            className="px-6 py-3 rounded-md font-medium bg-brandTeal text-onPrimary hover:bg-tealLight transition-colors duration-200 disabled:opacity-50"
          >
            {recommendLoading ? "Calculating..." : "Calculate Rebalance"}
          </button>
          {recommendations.length > 0 && (
            <>
              <button
                onClick={handleExecuteTrades}
                className="px-6 py-3 rounded-md font-medium bg-success text-onPrimary hover:opacity-90 transition-colors duration-200"
              >
                Execute Trades ({recommendations.length})
              </button>
              <button
                onClick={() => setRecommendations([])}
                className="px-6 py-3 rounded-md font-medium bg-surface text-ink border border-hairline hover:bg-hairline transition-colors duration-200"
              >
                Clear
              </button>
            </>
          )}
        </div>

        {/* Recommendations Table */}
        {recommendations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="text-left py-2 px-2 font-medium text-ink">Symbol</th>
                  <th className="text-left py-2 px-2 font-medium text-ink">Side</th>
                  <th className="text-right py-2 px-2 font-medium text-ink">Qty</th>
                  <th className="text-right py-2 px-2 font-medium text-ink">Est. Price</th>
                  <th className="text-left py-2 px-2 font-medium text-ink">Reason</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec, idx) => (
                  <tr key={idx} className="border-b border-hairline">
                    <td className="py-2 px-2 font-medium">{rec.symbol}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          rec.side === "Buy" ? "bg-success text-white" : "bg-error text-white"
                        }`}
                      >
                        {rec.side}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">{rec.qty.toFixed(4)}</td>
                    <td className="py-2 px-2 text-right">${rec.estimated_price.toFixed(2)}</td>
                    <td className="py-2 px-2 text-slate">{rec.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NAV History Section */}
      {navHistory.length > 0 && (
        <div className="bg-surfaceSoft rounded-xl p-lg mb-8">
          <h3 className="text-2xl font-semibold text-ink mb-4">NAV History</h3>
          <div className="h-48 relative">
            {/* Simple line chart visualization */}
            <div className="absolute inset-0 flex items-end justify-between px-4 pb-8">
              {navHistory.slice().reverse().map((record, idx, arr) => {
                const maxNav = Math.max(...navHistory.map(r => r.nav_value));
                const minNav = Math.min(...navHistory.map(r => r.nav_value));
                const height = ((record.nav_value - minNav) / (maxNav - minNav || 1)) * 100;
                const isLast = idx === arr.length - 1;
                return (
                  <div key={record.nav_id} className="flex flex-col items-center">
                    <div 
                      className="w-8 bg-brandTeal rounded-t"
                      style={{ height: `${height}%` }}
                    ></div>
                    <span className="text-xs text-slate mt-1">
                      {record.nav_date.split("-")[1]}/{record.nav_date.split("-")[2]}
                    </span>
                    {isLast && (
                      <span className="text-xs font-bold text-ink">
                        ${record.nav_value.toLocaleString()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-slate pr-2">
              <span>${Math.max(...navHistory.map(r => r.nav_value)).toLocaleString()}</span>
              <span>${Math.min(...navHistory.map(r => r.nav_value)).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}