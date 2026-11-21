import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import React from 'react'
import PortfolioOverview from './PortfolioOverview'
import { NotificationProvider } from '../contexts/NotificationProvider'

// Mock fetch globally. `api.request` reads `response.text()`, not `json()`.
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const overviewData = {
  margin: 10000,
  buffer: 5000,
  available_cash: 15000,
  total_pl: 1000,
  pool_health_index: 75,
  money_reserve_status: 'Optimal',
  portfolios: [
    {
      portfolio_id: 1,
      portfolio_name: 'Growth Portfolio',
      margin: 5000,
      buffer: 2000,
      available_cash: 7000,
      total_pl: 0,
      risk_status: 'Safe',
    },
    {
      portfolio_id: 2,
      portfolio_name: 'Risky Portfolio',
      margin: 2000,
      buffer: 1500,
      available_cash: 0,
      total_pl: 0,
      risk_status: 'Danger',
    },
  ],
}

const emptyData = { ...overviewData, portfolios: [] }

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(JSON.stringify(body)),
  }
}

function errorResponse(status: number, statusText = 'Error') {
  return {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(''),
  }
}

function renderOverview() {
  return render(
    <MemoryRouter>
      <DndProvider backend={HTML5Backend}>
        <NotificationProvider>
          <PortfolioOverview />
        </NotificationProvider>
      </DndProvider>
    </MemoryRouter>,
  )
}

describe('PortfolioOverview Component', () => {
  let consoleError: MockInstance

  beforeEach(() => {
    mockFetch.mockReset()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
    vi.clearAllMocks()
  })

  describe('Loading State', () => {
    it('renders a pulse skeleton shaped like the page instead of loading text', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))
      const { container } = renderOverview()

      expect(container.querySelector('.animate-pulse')).not.toBeNull()
      expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
      expect(screen.queryByText(/^Loading/)).toBeNull()
    })
  })

  describe('Failure State', () => {
    it('renders the failure card with a sentence and a Retry control when the API fails', async () => {
      mockFetch.mockResolvedValue(errorResponse(500, 'Internal Server Error'))
      renderOverview()

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('The server could not return your portfolio overview.')
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to All Assets' })).toHaveAttribute('href', '/all-assets')
      expect(alert).not.toHaveTextContent('500')
      expect(alert).not.toHaveTextContent('Internal Server Error')
      expect(consoleError).toHaveBeenCalled()
    })

    it('displays the same failure sentence on HTTP 404 without leaking the status', async () => {
      mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))
      renderOverview()

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('The server could not return your portfolio overview.')
      expect(alert).not.toHaveTextContent('404')
      expect(screen.queryByText('Failed to load overview data. Please try again later.')).toBeNull()
    })

    it('retries the same fetch, clears the error, and renders the data', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValueOnce(okResponse(overviewData))
      renderOverview()

      await screen.findByRole('alert')
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Page Header and Content', () => {
    it('renders the Overview page title', async () => {
      mockFetch.mockResolvedValue(okResponse(overviewData))
      renderOverview()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
      })
    })

    it('renders portfolio rows with formatted values', async () => {
      mockFetch.mockResolvedValue(okResponse(overviewData))
      renderOverview()

      await waitFor(() => {
        expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
        expect(screen.getByText('Risky Portfolio')).toBeInTheDocument()
        // 5000 + 2000 + 7000 + 0
        expect(screen.getByText('$14,000.00')).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('renders the empty state when no portfolios exist', async () => {
      mockFetch.mockResolvedValue(okResponse(emptyData))
      renderOverview()

      await waitFor(() => {
        expect(screen.getByText('No portfolios yet')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '+ Create Portfolio' })).toBeInTheDocument()
      })
    })
  })
})
