import { PortfolioOverviewItem } from '../types';

export function getPortfolioTags(p: PortfolioOverviewItem): string[] {
  const tags: string[] = [];
  const name = p.portfolio_name.toLowerCase();
  if (name.includes('binance') || name.includes('btc')) tags.push('crypto');
  if (p.is_bot_trading || name.includes('binance')) tags.push('bot');
  if (tags.length === 0 && (name.includes('fund') || name.includes('global'))) tags.push('FUND');
  return tags;
}

export function getProfitPct(p: PortfolioOverviewItem): number {
  if (p.profit_percentage !== undefined) return p.profit_percentage;
  const invested = (p.margin || 0) + (p.buffer || 0) + (p.available_cash || 0) + (p.money_market || 0);
  return invested > 0 ? ((p.total_pl || 0) / invested * 100) : 0;
}

export function getStatusMessage(p: PortfolioOverviewItem): string {
  if (p.status_message) return p.status_message;
  if (p.risk_status === "Danger") return "Rebalancing recommended: Variance above threshold.";
  if (p.risk_status === "Warning") return "Pool health monitoring required.";
  return "Pool health remains stable at 92% efficiency.";
}
