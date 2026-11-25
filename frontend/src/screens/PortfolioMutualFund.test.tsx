import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ManagedFund from "./PortfolioMutualFund";
import { NotificationProvider } from "../contexts/NotificationProvider";
import type { FundPortfolio, MFHolding } from "../types";

const apiMock = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  mfSettings: vi.fn(),
  mfHoldings: vi.fn(),
  mfOrders: vi.fn(),
  mfHistory: vi.fn(),
  mfAlerts: vi.fn(),
  mfSyncPrices: vi.fn(),
}));

vi.mock("../lib/api", () => ({ api: apiMock }));

const portfolio: FundPortfolio = {
  portfolio_id: 7,
  portfolio_name: "Test Fund",
  port_type: "Managed Fund",
  current_nav: 10000,
  margin_locked: 0,
  available_cash: 1000,
  cash_buffer_limit: 0,
  target_ratio: {},
  current_allocations: {},
  last_rebalance_date: null,
  risk_status: "Safe",
};

const holding: MFHolding = {
  holding_id: 1,
  portfolio_id: 7,
  asset: "PTT",
  qty: 10,
  avg_entry_price: 20,
  current_price: 25,
  market_value: 250,
  unrealized_pl: 50,
  unrealized_pl_pct: 25,
  profit_threshold: 0,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationProvider>
          <ManagedFund portfolioId="7" />
        </NotificationProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PortfolioMutualFund sync prices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getPortfolio.mockResolvedValue(portfolio);
    apiMock.mfSettings.mockResolvedValue({ id: 1, portfolio_id: 7, target_ratio: {} });
    apiMock.mfHoldings.mockResolvedValue([holding]);
    apiMock.mfOrders.mockResolvedValue([]);
    apiMock.mfHistory.mockResolvedValue([]);
    apiMock.mfAlerts.mockResolvedValue({ alerts: [] });
    apiMock.mfSyncPrices.mockResolvedValue({
      synced: 1,
      total: 1,
      missing: [],
      failed: [],
    });
  });

  it("syncs prices through the API and refetches the fund data", async () => {
    renderPage();

    const button = await screen.findByRole("button", { name: "Sync prices" });
    expect(apiMock.mfHoldings).toHaveBeenCalledTimes(1);

    fireEvent.click(button);

    await waitFor(() => expect(apiMock.mfSyncPrices).toHaveBeenCalledTimes(1));
    expect(apiMock.mfSyncPrices).toHaveBeenCalledWith(7);
    await waitFor(() => expect(apiMock.mfHoldings).toHaveBeenCalledTimes(2));
  });

  it("reports missing and unrefreshed symbols in one warning naming All Assets", async () => {
    apiMock.mfSyncPrices.mockResolvedValue({
      synced: 1,
      total: 2,
      missing: ["AAA"],
      failed: ["BBB"],
    });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Sync prices" }));

    const toast = await screen.findByText(/Synced 1 of 2 prices/);
    const text = toast.textContent ?? "";
    expect(text).toContain("AAA");
    expect(text).toContain("BBB");
    expect(text).toContain("Sync from orders");
    expect(text).toContain("All Assets");
    expect(text).not.toContain("!");
    expect(screen.getAllByText(/Synced 1 of 2 prices/)).toHaveLength(1);
  });
});
