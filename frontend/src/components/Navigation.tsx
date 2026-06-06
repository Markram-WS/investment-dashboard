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
import ThemeToggle from "./ThemeToggle";

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
    <nav className="bg-canvas border-b border-hairline sticky top-0 z-100 h-16 flex items-center px-6">
      <div className="flex items-center w-full max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-brand-yellow">
              <span className="text-ink font-bold text-lg">M</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink uppercase tracking-normal">
                InvestDesk
              </span>
              <span className="text-[10px] font-bold text-slate uppercase tracking-widest">
                Dashboard
              </span>
            </div>
          </NavLink>
        </div>

        <div className="flex items-center gap-px mx-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                background: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--color-slate)',
              })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium no-underline transition-colors"
              end
            >
              <item.Icon className="w-5 h-5 nav-icon-hover" />
              {item.name}
            </NavLink>
          ))}

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setPortfoliosDropdownOpen(!portfoliosDropdownOpen)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-slate bg-transparent border-none cursor-pointer transition-colors hover:bg-surface"
            >
              <IconFolder className="w-5 h-5 nav-icon-hover" />
              <span>Portfolios</span>
              <IconChevronDown className="w-5 h-5 nav-icon-hover" />
            </button>

            {portfoliosDropdownOpen && (
              <div className="absolute left-0 mt-1 w-50 bg-canvas border border-hairline rounded-xl shadow-lg overflow-hidden z-10">
                {portfolios.map((p) => {
                  const color = p.name.toLowerCase().includes('binance') || p.name.toLowerCase().includes('btc')
                    ? 'var(--color-brand-teal)'
                    : 'var(--color-brand-coral)';
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setPortfoliosDropdownOpen(false); }}
                      className="w-full px-4 py-3 text-sm font-medium text-slate bg-transparent border-none flex items-center gap-2.5 cursor-pointer hover:bg-surface"
                    >
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                      {p.name}
                    </button>
                  );
                })}
                {portfolios.length === 0 && (
                  <p className="px-4 py-3 text-[13px] text-slate m-0">No portfolios</p>
                )}
                <div className="h-px bg-hairline my-1" />
                <button
                  onClick={() => { setPortfoliosDropdownOpen(false); navigate('/create-portfolio'); }}
                  className="w-full px-4 py-3 text-sm font-medium text-brand-teal bg-transparent border-none cursor-pointer hover:bg-surface"
                >
                  + Create Portfolio
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />
          <button className="w-10 h-10 flex items-center justify-center bg-transparent border border-hairline rounded-full cursor-pointer">
            <IconBell className="w-5 h-5 nav-icon-hover" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center bg-transparent border border-hairline rounded-full cursor-pointer">
            <IconMoreHorizontal className="w-5 h-5 nav-icon-hover" />
          </button>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="bg-none border-none p-2 rounded-md cursor-pointer ml-auto"
        >
          {mobileOpen ? <IconX className="w-5 h-5 nav-icon-hover" /> : <IconMenu className="w-5 h-5 nav-icon-hover" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="bg-canvas border-t border-hairline shadow-lg absolute top-16 left-0 right-0">
          <div className="p-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className="no-underline"
              >
                {({ isActive }) => (
                  <div className="px-4 py-3 rounded-md text-[15px] font-medium mb-0.5 flex items-center gap-2.5"
                    style={{
                      background: isActive ? 'var(--color-primary)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--color-ink)',
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
                className="bg-none border-none px-4 py-3 text-sm text-ink flex items-center gap-2.5 w-full text-left rounded cursor-pointer hover:bg-surface"
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
