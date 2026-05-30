import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

// Inline SVG icons (optimized from Material Symbols)
function SVGIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    dashboard: "M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120Z",
    wallet: "M200-200v-560 560Zm0 80q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v320q0 33-23.5 56.5T760-360H200Zm0-80v-400v400Z",
    swap: "M280-160 80-360l200-200 56 57-103 103h287v80H233l103 103-56 57Zm400-240-56-57 103-103H440v-80h287L637-617l56 57-200 200Z",
    security: "M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 139-90.5 263.5T480-80Zm-120-40q100-33 166-117t66-197v-214l-200-78-200 78v214q0 100 66 197t166 117Z",
    folder: "M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T799-120H160Z",
    expand: "M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z",
    notifications: "M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-812v28q83 34 125 98t42 148v280h80v80H160Zm280-320q0-50 35-85t85-35v-40q-50 0-85 35t-35 85v40Z",
    more: "M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Z",
    menu: "M80-720q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v80q0 33-23.5 56.5T800-560H160q-33 0-56.5-23.5T80-640v-80Zm0 240q0-33 23.5-56.5T160-560h640q33 0 56.5 23.5T880-480v80q0 33-23.5 56.5T800-320H160q-33 0-56.5-23.5T80-400v-80Zm0 240q0-33 23.5-56.5T160-320h640q33 0 56.5 23.5T880-240v80q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160v-80Z",
    close: "M640-240q-17 0-28.5-11.5T600-280v-80q0-17 11.5-28.5T640-400h160q17 0 28.5 11.5T840-360v80q0 17-11.5 28.5T800-280H640v80h160v80H640Zm-480 0q-17 0-28.5-11.5T120-200v-80q0-17 11.5-28.5T160-320h160q17 0 28.5 11.5T360-280v80q0 17-11.5 28.5T320-160H160v80h160v-80H160Z"
  };
  
  return (
    <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" style={{ fontSize: 20 }}>
      <path d={icons[name] || icons.menu} />
    </svg>
  );
}

const NAV_ITEMS = [
  { name: "Overview", path: "/", icon: "dashboard" },
  { name: "All Assets", path: "/all-assets", icon: "wallet" },
  { name: "Transactions", path: "/transactions", icon: "swap" },
  { name: "Risk Analytics", path: "/risk-analytics", icon: "security" },
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
              <SVGIcon name={item.icon} />
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
              <SVGIcon name="folder" />
              <span>Portfolios</span>
              <SVGIcon name="expand" />
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
            <SVGIcon name="notifications" />
          </button>
          <button style={{
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid var(--color-hairline)',
            borderRadius: '50%', cursor: 'pointer'
          }}>
            <SVGIcon name="more" />
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
          <SVGIcon name={mobileOpen ? "close" : "menu"} />
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
                    <SVGIcon name={item.icon} />
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
                <SVGIcon name="folder" />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}