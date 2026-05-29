import { render, screen, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Navigation from './Navigation'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Wrapper component for router context
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
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

  it('renders the brand anchor with INVESTDESK text', () => {
    renderWithRouter(<Navigation />)
    
    expect(screen.getByText('I')).toBeInTheDocument()
    expect(screen.getByText('INVESTDESK')).toBeInTheDocument()
  })

  it('renders all 4 navigation menu items', () => {
    renderWithRouter(<Navigation />)
    
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('All Assets')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Risk Analytics')).toBeInTheDocument()
  })

  it('renders the portfolio selector dropdown', () => {
    renderWithRouter(<Navigation />)
    
    expect(screen.getByText(/Portfolios: Binance/)).toBeInTheDocument()
  })

  it('renders the notification icon button', () => {
    renderWithRouter(<Navigation />)
    
    // The notification button with material-icons is accessible by name
    const notificationButton = screen.getByRole('button', { name: 'notifications' })
    expect(notificationButton).toBeInTheDocument()
  })

  it('has correct navigation links', () => {
    renderWithRouter(<Navigation />)
    
    const overviewLink = screen.getByText('Overview').closest('a')
    expect(overviewLink).toHaveAttribute('href', '/')
    
    const allAssetsLink = screen.getByText('All Assets').closest('a')
    expect(allAssetsLink).toHaveAttribute('href', '/all-assets')
    
    const transactionsLink = screen.getByText('Transactions').closest('a')
    expect(transactionsLink).toHaveAttribute('href', '/transactions')
    
    const riskAnalyticsLink = screen.getByText('Risk Analytics').closest('a')
    expect(riskAnalyticsLink).toHaveAttribute('href', '/risk-analytics')
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
    const menuButton = screen.getByLabelText('Toggle menu')
    expect(menuButton).toBeInTheDocument()
  })

  it('applies active state styling with bg-primary for current route', () => {
    renderWithRouter(<Navigation />)
    
    // Overview should be active on "/" route (default route in BrowserRouter)
    const overviewLink = screen.getByText('Overview').closest('a')
    expect(overviewLink).toHaveClass('bg-primary', 'text-white')
  })
})