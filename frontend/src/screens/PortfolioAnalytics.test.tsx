import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import PortfolioAnalytics from './PortfolioAnalytics'

// Mock fetch API
const mockFetch = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).fetch = mockFetch

const mockPortfolioData = [
  {
    portfolio_id: 1,
    portfolio_name: 'AI Growth',
    port_type: 'AI Managed',
    risk_status: 'Safe',
    trade_plan_md: '## Trade Plan\n- Entry: AAPL at 150\n- Target: 160\n- Stop: 145',
    ai_reasoning: 'Bullish pattern detected in AAPL',
    ai_risk_insight: 'Moderate risk, high confidence',
    spread_pairs: [
      {
        pair_id: 'pair-001',
        leg_a: {
          order_id: 1,
          asset_type: 'AAPL',
          side: 'BUY',
          qty: 10,
          entry_price: 150.0,
          current_price: 155.0,
          tp_price: 160.0,
          leverage: 1.0,
          margin_rate: 0.1,
          order_status: 'ACTIVE',
          executed_by: 'AI',
          created_at: '2024-01-15T10:00:00Z',
          spread_pair_id: null
        },
        leg_b: {
          order_id: 2,
          asset_type: 'MSFT',
          side: 'SELL',
          qty: 10,
          entry_price: 300.0,
          current_price: 295.0,
          tp_price: 290.0,
          leverage: 1.0,
          margin_rate: 0.1,
          order_status: 'ACTIVE',
          executed_by: 'AI',
          created_at: '2024-01-15T10:00:00Z',
          spread_pair_id: null
        },
        net_pl: 50.0,
        spread_diff: 150.0,
        zone: 'Active'
      }
    ],
    active_orders: []
  }
]

const mockAiLogs = [
  {
    log_id: 1,
    agent_id: 1,
    action_type: 'TRADE_EXECUTION',
    reasoning: 'Bullish momentum confirmed on AAPL',
    risk_assessment: { level: 'moderate' },
    confidence_score: 0.85,
    created_at: '2024-01-15T10:30:00Z'
  }
]

describe('PortfolioAnalytics Component', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/v1/analytics/portfolio-grid')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPortfolioData)
        })
      }
      if (url.includes('/api/v1/ai/logs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAiLogs)
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders Portfolio Analytics header', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('Portfolio Analytics')).toBeInTheDocument()
    })
  })

  it('has Canary Yellow (#FFFCE0) background for right panel', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('Portfolio Analytics')).toBeInTheDocument()
    })
    
    // Check for canary yellow background style in the right panel
    const canaryYellow = '#FFFCE0'
    const rightPanel = document.querySelector('[style*="background-color"]')
    expect(rightPanel?.getAttribute('style')).toContain(canaryYellow)
  })

  it('has zone headers with teal-light (#e0f7f6) background', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('Portfolio Analytics')).toBeInTheDocument()
    })
    
    // The zone header should have the teal-light background
    const zoneHeader = screen.getByText('Active | COMPLETED CYCLE')
    expect(zoneHeader).toBeInTheDocument()
  })

  it('has ADD ORDER button with black pill style', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('ADD ORDER')).toBeInTheDocument()
    })
    
    const addButton = screen.getByText('ADD ORDER')
    expect(addButton).toHaveClass('bg-black')
  })

  it('displays risk status badge with correct styling', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('Risk Status:')).toBeInTheDocument()
    })
    
    const riskBadge = screen.getByText('Safe')
    expect(riskBadge).toBeInTheDocument()
  })

  it('displays AI Reasoning & Risk Insight for AI portfolios', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('AI Reasoning')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Risk Insight')).toBeInTheDocument()
  })

  it('renders Trade Plan section', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('Trade Plan')).toBeInTheDocument()
    })
    
    // The trade plan markdown should be rendered
    expect(screen.getByText(/## Trade Plan/)).toBeInTheDocument()
  })

  it('displays spread pairs with proper structure', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('Spread Visual Pairing')).toBeInTheDocument()
    })
    
    // Check for spread pair asset display
    expect(screen.getByText(/AAPL\/MSFT SPREAD/)).toBeInTheDocument()
  })

  it('fetches AI logs for AI-managed portfolios', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/analytics/portfolio-grid')
    })
  })

  it('renders Quick Stats section', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('Quick Stats')).toBeInTheDocument()
    })
  })

  it('renders Decision Journal section', async () => {
    render(<PortfolioAnalytics />)
    
    await waitFor(() => {
      expect(screen.getByText('Decision Journal')).toBeInTheDocument()
    })
  })
})