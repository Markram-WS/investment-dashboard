import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import PortfolioOverview from './PortfolioOverview'

// Mock fetch globally
const mockFetch = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).fetch = mockFetch

// Mock data matching OverviewResponse interface
const mockOverviewData = {
  margin: 10000,
  buffer: 5000,
  available_cash: 15000,
  money_market: 5000,
  pool_health_index: 75,
  money_reserve_status: 'optimal',
  portfolios: [
    {
      portfolio_id: 1,
      portfolio_name: 'Growth Portfolio',
      margin: 5000,
      buffer: 2000,
      available: 7000,
      risk_status: 'Safe',
    },
    {
      portfolio_id: 2,
      portfolio_name: 'Conservative Portfolio',
      margin: 3000,
      buffer: 1500,
      available: 4000,
      risk_status: 'Warning',
    },
    {
      portfolio_id: 3,
      portfolio_name: 'Risky Portfolio',
      margin: 2000,
      buffer: 1500,
      available: 0,
      risk_status: 'Danger',
    },
  ],
}

// Mock data triggering global risk alert
const mockRiskAlertData = {
  margin: 50000,
  buffer: 40000,
  available_cash: 5000,
  money_market: 5000,
  pool_health_index: 50,
  money_reserve_status: 'danger',
  portfolios: [],
}

// Mock empty portfolios data
const mockEmptyPortfoliosData = {
  margin: 10000,
  buffer: 5000,
  available_cash: 15000,
  money_market: 0,
  pool_health_index: 100,
  money_reserve_status: 'optimal',
  portfolios: [],
}

describe('PortfolioOverview Component', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOverviewData),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ===== Loading State Tests =====
  describe('Loading State', () => {
    it('renders loading state before data is fetched', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))
      render(<PortfolioOverview />)

      expect(screen.getByText('Loading Overview...')).toBeInTheDocument()
    })
  })

  // ===== Error State Tests =====
  describe('Error State', () => {
    it('renders error message when API fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Error Loading Overview')).toBeInTheDocument()
      })
    })

    it('displays specific error message on HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 })
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(
          screen.getByText('Failed to load overview data. Please try again later.')
        ).toBeInTheDocument()
      })
    })
  })

  // ===== Header and Currency Tests =====
  describe('Page Header', () => {
    it('renders Overview page title', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument()
      })
    })

    it('renders currency toggle button', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Switch to THB')).toBeInTheDocument()
      })
    })

    it('toggles currency between USD and THB', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Switch to THB')).toBeInTheDocument()
      })

      const toggleButton = screen.getByText('Switch to THB')
      fireEvent.click(toggleButton)

      expect(screen.getByText('Switch to USD')).toBeInTheDocument()
    })
  })

  // ===== Global Risk Alert Tests =====
  describe('Global Risk Alert', () => {
    it('renders global risk alert when margin + buffer exceeds 85% of total cash', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRiskAlertData),
      })
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText(/Global risk alert:/)).toBeInTheDocument()
      })
    })

    it('does not show global risk alert when conditions are not met', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument()
      })

      expect(screen.queryByText(/Global risk alert:/)).not.toBeInTheDocument()
    })
  })

  // ===== Hero Summary Card Tests =====
  describe('Hero Summary Card (Global Cash Breakdown)', () => {
    it('renders Margin value', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Margin')).toBeInTheDocument()
        expect(screen.getByText('$10,000.00')).toBeInTheDocument()
      })
    })

    it('renders Buffer value', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Buffer')).toBeInTheDocument()
        expect(screen.getByText('$5,000.00')).toBeInTheDocument()
      })
    })

    it('renders Available Cash value', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Available Cash')).toBeInTheDocument()
        expect(screen.getByText('$15,000.00')).toBeInTheDocument()
      })
    })

    it('renders Money Market value', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Money Market')).toBeInTheDocument()
        expect(screen.getByText('$5,000.00')).toBeInTheDocument()
      })
    })
  })

  // ===== Pool Health Index Tests =====
  describe('Pool Health Index', () => {
    it('renders Pool Health Index section', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Pool Health Index')).toBeInTheDocument()
      })
    })

    it('displays health index percentage', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument()
      })
    })

    it('renders gauge description text', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(
          screen.getByText(/Measures strategy alignment and true risk/)
        ).toBeInTheDocument()
      })
    })
  })

  // ===== Money Reserve Status Tests =====
  describe('Money Reserve Status', () => {
    it('renders Money Reserve Status section', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Money Reserve Status')).toBeInTheDocument()
      })
    })

    it('displays zone labels Danger, Optimal, Inefficient', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Danger')).toBeInTheDocument()
        expect(screen.getByText('Optimal')).toBeInTheDocument()
        expect(screen.getByText('Inefficient')).toBeInTheDocument()
      })
    })

    it('displays optimal status message', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(
          screen.getByText(/Optimal: Global cash is between 120% and 200%/)
        ).toBeInTheDocument()
      })
    })
  })

  // ===== Portfolio Cards Tests =====
  describe('Active Portfolios Grid', () => {
    it('renders Active Portfolios heading', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Active Portfolios')).toBeInTheDocument()
      })
    })

    it('renders all portfolio names', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
        expect(screen.getByText('Conservative Portfolio')).toBeInTheDocument()
        expect(screen.getByText('Risky Portfolio')).toBeInTheDocument()
      })
    })

    it('renders portfolio margin values', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Margin: $5,000.00')).toBeInTheDocument()
      })
    })

    it('renders portfolio buffer values', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Buffer: $2,000.00')).toBeInTheDocument()
      })
    })

    it('renders portfolio available values', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Available: $7,000.00')).toBeInTheDocument()
      })
    })

    it('renders portfolio total value', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        // Growth Portfolio: 5000 + 2000 + 7000 = 14000
        expect(screen.getByText('Total Value: $14,000.00')).toBeInTheDocument()
      })
    })
  })

  // ===== Risk Status Indicator Tests =====
  describe('Risk Status Indicators', () => {
    it('displays Safe status label', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Safe')).toBeInTheDocument()
      })
    })

    it('displays Warning status label', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Warning')).toBeInTheDocument()
      })
    })

    it('displays Danger status label', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Danger')).toBeInTheDocument()
      })
    })
  })

  // ===== Empty State Tests =====
  describe('Empty State', () => {
    it('renders empty state when no portfolios exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEmptyPortfoliosData),
      })
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Create your first portfolio')).toBeInTheDocument()
      })
    })

    it('renders Create Portfolio button in empty state', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEmptyPortfoliosData),
      })
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Create Portfolio')).toBeInTheDocument()
      })
    })
  })

  // ===== Add Portfolio Card Tests =====
  describe('Add Portfolio Card', () => {
    it('renders add portfolio card with plus icon', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('+')).toBeInTheDocument()
      })
    })

    it('renders Create new portfolio text', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Create new portfolio')).toBeInTheDocument()
      })
    })
  })

  // ===== Currency Conversion Tests =====
  describe('Currency Conversion', () => {
    it('converts values to THB when currency is switched', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('$10,000.00')).toBeInTheDocument()
      })

      const toggleButton = screen.getByText('Switch to THB')
      fireEvent.click(toggleButton)

      // 10000 * 35 = 350000 THB
      await waitFor(() => {
        expect(screen.getByText('฿350,000.00')).toBeInTheDocument()
      })
    })

    it('switches back to USD when clicked again', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Switch to THB')).toBeInTheDocument()
      })

      const toggleButton = screen.getByText('Switch to THB')
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText('Switch to USD')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Switch to USD'))

      await waitFor(() => {
        expect(screen.getByText('$10,000.00')).toBeInTheDocument()
      })
    })
  })

  // ===== API Call Tests =====
  describe('API Integration', () => {
    it('calls correct API endpoint on mount', async () => {
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/overview/')
      })
    })

    it('handles single portfolio correctly', async () => {
      const singlePortfolioData = {
        ...mockOverviewData,
        portfolios: [mockOverviewData.portfolios[0]],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(singlePortfolioData),
      })
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })
    })
  })

  // ===== Edge Cases =====
  describe('Edge Cases', () => {
    it('handles zero money market value', async () => {
      const zeroMoneyMarketData = { ...mockOverviewData, money_market: 0 }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(zeroMoneyMarketData),
      })
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('Money Market')).toBeInTheDocument()
        expect(screen.getByText('$0.00')).toBeInTheDocument()
      })
    })

    it('handles very large portfolio values', async () => {
      const largeValuesData = {
        ...mockOverviewData,
        margin: 10000000,
        buffer: 5000000,
        available_cash: 2000000,
        money_market: 3000000,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(largeValuesData),
      })
      render(<PortfolioOverview />)

      await waitFor(() => {
        expect(screen.getByText('$10,000,000.00')).toBeInTheDocument()
      })
    })
  })
})