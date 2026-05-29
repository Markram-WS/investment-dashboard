import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const NAV_ITEMS = [
  { name: "Overview", path: "/" },
  { name: "All Assets", path: "/all-assets" },
  { name: "Transactions", path: "/transactions" },
  { name: "Risk Analytics", path: "/risk-analytics" },
];

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
    }
  }, []);

  useEffect(() => {
    if (portfolioOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [portfolioOpen, handleOutsideClick]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const current = portfolios.find((p) => p.id === selectedId);

  return (
    <header style={{
      background: 'var(--color-canvas)',
      borderBottom: '1px solid var(--color-hairline)',
      position: 'sticky', top: 0, zIndex: 50,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <nav style={{
        maxWidth: 1120, margin: '0 auto',
        height: 64, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 24px'
      }}>
        {/* Brand */}
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>I</span>
          </div>
          <span style={{
            fontSize: 18, fontWeight: 600,
            color: 'var(--color-ink)',
            fontFamily: 'var(--font-heading)', letterSpacing: '-0.3px'
          }}>
            INVESTDESK
          </span>
        </NavLink>

        {/* Desktop Nav */}
        <div className="hidden md:flex" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.path} to={item.path} className="nav-link" end>
              {item.name}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Portfolio Selector — Desktop */}
          <div className="hidden md:block" style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setPortfolioOpen(!portfolioOpen)}
              className="select-trigger"
              style={{ fontSize: 13, padding: '6px 12px' }}
            >
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {current?.name ?? "All Portfolios"}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                style={{ transform: portfolioOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {portfolioOpen && (
              <div className="select-dropdown" style={{ right: 0, marginTop: 4 }}>
                <button
                  onClick={() => { setSelectedId(null); setPortfolioOpen(false); }}
                  className={`select-option ${selectedId === null ? 'active' : ''}`}
                >
                  All Portfolios
                </button>
                {portfolios.length > 0 && (
                  <div style={{ height: 1, background: 'var(--color-hairline)', margin: '4px 0' }} />
                )}
                {portfolios.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); setPortfolioOpen(false); }}
                    className={`select-option ${selectedId === p.id ? 'active' : ''}`}
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {p.name}
                  </button>
                ))}
                {portfolios.length === 0 && (
                  <p style={{ padding: '12px 14px', fontSize: 13, color: 'var(--color-slate)', margin: 0 }}>
                    No portfolios found
                  </p>
                )}
                <div style={{ height: 1, background: 'var(--color-hairline)', margin: '4px 0' }} />
                <button
                  onClick={() => { setPortfolioOpen(false); navigate("/create-portfolio"); }}
                  className="select-option"
                  style={{ color: 'var(--color-brand-teal)', fontWeight: 500 }}
                >
                  + Create Portfolio
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              background: 'none', border: 'none', padding: 8,
              borderRadius: 'var(--rounded-md)', cursor: 'pointer'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth={2}>
              {mobileOpen
                ? <path d="M6 18L18 6M6 6l12 12" />
                : <path d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden" style={{
          background: 'var(--color-canvas)',
          borderTop: '1px solid var(--color-hairline)',
          boxShadow: 'var(--shadow-lg)'
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
                    marginBottom: 2
                  }}>
                    {item.name}
                  </div>
                )}
              </NavLink>
            ))}
          </div>
          {portfolios.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-hairline)', padding: '12px 16px' }}>
              <p className="label-caps" style={{ marginBottom: 8 }}>Portfolios</p>
              {portfolios.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setMobileOpen(false); }}
                  style={{
                    background: 'none', border: 'none', padding: '8px 12px',
                    fontSize: 14, color: 'var(--color-ink)',
                    display: 'block', width: '100%', textAlign: 'left',
                    borderRadius: 'var(--rounded-sm)', cursor: 'pointer'
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
