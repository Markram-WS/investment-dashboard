import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  IconDashboard,
  IconTrendingUp,
  IconRepeat,
  IconShield,
  IconFolder,
  IconChevronDown,
  IconBell,
  IconMoreHorizontal,
  IconMenu,
  IconX,
} from "./icons";

const NAV_ITEMS = [
  { name: "Overview", path: "/", Icon: IconDashboard },
  { name: "All Assets", path: "/all-assets", Icon: IconTrendingUp },
  { name: "Transactions", path: "/transactions", Icon: IconRepeat },
  { name: "Risk Analytics", path: "/risk-analytics", Icon: IconShield },
];

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [portfoliosDropdownOpen, setPortfoliosDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: portfolioList = [] } = useQuery({
    queryKey: ["nav-portfolios"],
    queryFn: () => api.getPortfolios(),
    staleTime: 30000,
  });

  const portfolios = portfolioList.map((p: any) => ({ id: p.portfolio_id, name: p.portfolio_name }));

  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setPortfolioOpen(false);
      setPortfoliosDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    if (portfolioOpen || portfoliosDropdownOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [portfolioOpen, portfoliosDropdownOpen, handleOutsideClick]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <nav style={{
      background: 'var(--color-canvas)',
      borderBottom: '1px solid var(--color-hairline)',
      position: 'sticky', top: 0, zIndex: 100,
      height: 64, display: 'flex', alignItems: 'center',
      padding: '0 24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        {/* Branding (Left) - Like example.html */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 4,
              background: 'var(--color-brand-yellow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ color: 'var(--color-ink)', fontWeight: 700, fontSize: 18 }}>M</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', textTransform: 'uppercase', letterSpacing: 0 }}>
                InvestDesk
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-slate)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Dashboard
              </span>
            </div>
          </NavLink>
        </div>

        {/* Navigation Links (Center) - Using inline styles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, margin: '0 auto' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              style={({ isActive }) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: '9999px',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'background 0.15s ease, color 0.15s ease',
                background: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--color-slate)',
                border: 'none'
              })}
              end
            >
              <item.Icon className="w-5 h-5 nav-icon-hover" />
              {item.name}
            </NavLink>
          ))}
          
          {/* Portfolios Dropdown - Like example.html */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setPortfoliosDropdownOpen(!portfoliosDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: '9999px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--color-slate)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.15s ease, background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <IconFolder className="w-5 h-5 nav-icon-hover" />
              <span>Portfolios</span>
              <IconChevronDown className="w-5 h-5 nav-icon-hover" />
            </button>
            
            {portfoliosDropdownOpen && (
              <div style={{
                position: 'absolute', left: 0, marginTop: 4, width: 200,
                background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)',
                borderRadius: 12, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 10
              }}>
                {portfolios.map((p) => {
                  const color = p.name.toLowerCase().includes('binance') || p.name.toLowerCase().includes('btc') 
                    ? 'var(--color-brand-teal)' 
                    : 'var(--color-brand-coral)';
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setPortfoliosDropdownOpen(false); }}
                      style={{
                        width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 500,
                        color: 'var(--color-slate)', background: 'transparent', border: 'none',
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                      {p.name}
                    </button>
                  );
                })}
                {portfolios.length === 0 && (
                  <p style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-slate)', margin: 0 }}>No portfolios</p>
                )}
                <div style={{ height: 1, background: 'var(--color-hairline)', margin: '4px 0' }} />
                <button
                  onClick={() => { setPortfoliosDropdownOpen(false); navigate('/create-portfolio'); }}
                  style={{
                    width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 500,
                    color: 'var(--color-brand-teal)', background: 'transparent', border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  + Create Portfolio
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top Right Utilities (Right) - Like example.html */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button style={{
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid var(--color-hairline)',
            borderRadius: '50%', cursor: 'pointer'
          }}>
            <IconBell className="w-5 h-5 nav-icon-hover" />
          </button>
          <button style={{
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid var(--color-hairline)',
            borderRadius: '50%', cursor: 'pointer'
          }}>
            <IconMoreHorizontal className="w-5 h-5 nav-icon-hover" />
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            background: 'none', border: 'none', padding: 8,
            borderRadius: 'var(--rounded-md)', cursor: 'pointer', marginLeft: 'auto'
          }}
        >
          {mobileOpen ? <IconX className="w-5 h-5 nav-icon-hover" /> : <IconMenu className="w-5 h-5 nav-icon-hover" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div style={{
          background: 'var(--color-canvas)',
          borderTop: '1px solid var(--color-hairline)',
          boxShadow: 'var(--shadow-lg)',
          position: 'absolute', top: 64, left: 0, right: 0
        }}>
          <div style={{ padding: '8px 16px' }}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                style={{ textDecoration: 'none' }}
              >
                {({ isActive }) => (
                  <div style={{
                    padding: '12px 16px', borderRadius: 'var(--rounded-md)',
                    fontSize: 15, fontWeight: 500,
                    background: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--color-ink)',
                    marginBottom: 2,
                    display: 'flex', alignItems: 'center', gap: 10
                  }}>
                    <item.Icon className="w-5 h-5 nav-icon-hover" />
                    {item.name}
                  </div>
                )}
              </NavLink>
            ))}
            {portfolios.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setMobileOpen(false); }}
                style={{
                  background: 'none', border: 'none', padding: '12px 16px',
                  fontSize: 14, color: 'var(--color-ink)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', textAlign: 'left',
                  borderRadius: 'var(--rounded-sm)', cursor: 'pointer'
                }}
              >
                <IconFolder className="w-5 h-5 nav-icon-hover" />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}