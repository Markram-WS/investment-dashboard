import { render, screen, act, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Navigation from './Navigation'
import { NotificationProvider } from '../contexts/NotificationProvider'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../lib/api', () => ({
  api: {
    getPortfolios: vi.fn(async () => []),
    getOverview: vi.fn(async () => ({ portfolios: [] })),
  },
}))

// Wrapper component for router, query and notification context
const renderWithRouter = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </NotificationProvider>
    </QueryClientProvider>
  )
}

describe('Navigation Component', () => {
  // Store original window dimensions
  const originalInnerWidth = window.innerWidth

  beforeEach(() => {
    // Reset to desktop view before each test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    window.dispatchEvent(new Event('resize'))
  })

  afterEach(() => {
    // Restore original
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
    window.dispatchEvent(new Event('resize'))
  })

  it('renders the brand anchor with InvestDesk text', () => {
    renderWithRouter(<Navigation />)
    
    expect(screen.getByText('M')).toBeInTheDocument()
    const brand = screen.getByText('InvestDesk').closest('a')
    expect(brand).toHaveAttribute('href', '/')
  })

  it('renders all 3 navigation menu items', () => {
    renderWithRouter(<Navigation />)
    
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Asset')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.queryByText('Risk Analytics')).not.toBeInTheDocument()
  })

  it('renders the portfolio selector dropdown', () => {
    renderWithRouter(<Navigation />)
    
    const selector = screen.getByRole('button', { name: /Portfolios/ })
    expect(selector).toBeInTheDocument()

    fireEvent.click(selector)
    expect(screen.getByText('0 portfolios')).toBeInTheDocument()
    expect(screen.getByText('No portfolios')).toBeInTheDocument()
  })

  it('renders the notification icon button', () => {
    renderWithRouter(<Navigation />)
    
    // The notification button with material-icons is accessible by name
    const notificationButton = screen.getByRole('button', { name: 'Notifications' })
    expect(notificationButton).toBeInTheDocument()
  })

  it('has correct navigation links', () => {
    renderWithRouter(<Navigation />)
    
    const overviewLink = screen.getByText('Overview').closest('a')
    expect(overviewLink).toHaveAttribute('href', '/')
    
    const allAssetsLink = screen.getByText('Asset').closest('a')
    expect(allAssetsLink).toHaveAttribute('href', '/all-assets')
    
    const transactionsLink = screen.getByText('Transactions').closest('a')
    expect(transactionsLink).toHaveAttribute('href', '/transactions')
  })

  it('renders mobile menu button on mobile viewport', () => {
    // Set mobile viewport and trigger resize
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    })
    
    // Use act to wrap the state update
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    
    renderWithRouter(<Navigation />)
    
    // Mobile menu button should be visible on mobile
    const menuButton = screen.getByLabelText('Open menu')
    expect(menuButton).toBeInTheDocument()
  })

  it('applies active state styling with the primary colour for current route', () => {
    renderWithRouter(<Navigation />)
    
    // Overview should be active on "/" route (default route in BrowserRouter)
    const overviewLink = screen.getByText('Overview').closest('a')
    expect(overviewLink).toHaveAttribute('aria-current', 'page')
    expect((overviewLink as HTMLElement).style.background).toBe('var(--color-primary)')
  })
})