import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { BrokerRecord, PortfolioPayload } from '../lib/api';
import PageLayout from '../components/PageLayout';
import PageHeader from '../components/PageHeader';
import {
  CONTROL_LABEL, CONTROL_INPUT, CONTROL_HELPER, CONTROL_VALUE,
  CONTROL_BUTTON_PRIMARY, CONTROL_BUTTON_SECONDARY,
} from '../screens/components/controlStyles';

const panelStyle = {
  background: "var(--color-canvas)",
  borderRadius: "var(--rounded-lg)",
  border: "1px solid var(--color-hairline)",
  padding: "var(--space-lg)",
} as const;

const railStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-sm)",
  alignSelf: "start",
  position: "sticky",
  top: 76,
} as const;

const cardStyle = {
  background: "var(--color-canvas)",
  borderRadius: "var(--rounded-xl)",
  border: "1px solid var(--color-hairline)",
  padding: "var(--space-sm)",
} as const;

const groupHeadStyle = {
  margin: 0,
  fontSize: "var(--fs-section)",
  fontWeight: 600,
  color: "var(--color-ink)",
} as const;

const ruleStyle = {
  borderTop: "1px solid var(--color-hairline)",
  paddingTop: "var(--space-sm)",
} as const;

const eyebrowStyle = {
  margin: 0,
  fontSize: "var(--fs-label)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-slate)",
} as const;

const PORT_TYPES = ['Managed Fund', 'Active Trading', 'Custom Portfolio'] as const;

const PORT_TYPE_DESCRIPTIONS: Record<string, string> = {
  'Managed Fund': 'Focus on portfolio rebalancing according to target ratios.',
  'Active Trading': 'Manage individual orders (stocks, futures, options).',
  'Custom Portfolio': 'Isolated external database for orders, transactions, and assets.',
};

const PortTypeIcon: React.FC<{ type: string; size?: number }> = ({ type, size = 24 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (type === 'Managed Fund') {
    return (
      <svg {...common}>
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    );
  }
  if (type === 'Active Trading') {
    return (
      <svg {...common}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
};

const fmtMoney = (value: unknown) => `$${(Number(value) || 0).toFixed(2)}`;

/** Parses an allocation map from user JSON; numeric entries only, null when invalid. */
const parseTargetRatios = (raw: string): Record<string, number> | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const ratios: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number') ratios[key] = value;
    }
    return ratios;
  } catch {
    return null;
  }
};

const affixShellStyle = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: "100%",
  minHeight: "var(--control-h)",
  background: "var(--color-canvas)",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--control-radius)",
} as const;

const affixStyle = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: "var(--fs-label)",
  fontWeight: 500,
  color: "var(--color-slate)",
  lineHeight: 1,
  pointerEvents: "none",
} as const;

const affixInputStyle = {
  width: "100%",
  minHeight: "calc(var(--control-h) - 2px)",
  fontSize: "var(--fs-label)",
  fontWeight: 500,
  color: "var(--color-ink)",
  background: "transparent",
  border: "none",
  borderRadius: "var(--control-radius)",
  padding: "var(--control-pad-y) var(--control-pad-x)",
  lineHeight: 1.3,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
  outline: "none",
} as const;

type AffixInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string;
  suffix?: string;
};

/** Numeric input with a leading/trailing affix inside one control shell. */
const AffixInput: React.FC<AffixInputProps> = ({ prefix, suffix, style, ...props }) => (
  <div className="control-money" style={affixShellStyle}>
    {prefix ? (
      <span aria-hidden="true" style={{ ...affixStyle, left: 8 }}>{prefix}</span>
    ) : null}
    <input
      {...props}
      style={{
        ...affixInputStyle,
        paddingLeft: prefix ? 20 : "var(--control-pad-x)",
        paddingRight: suffix ? 20 : "var(--control-pad-x)",
        ...style,
      }}
    />
    {suffix ? (
      <span aria-hidden="true" style={{ ...affixStyle, right: 8 }}>{suffix}</span>
    ) : null}
  </div>
);

const summaryRowStyle = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  margin: 0,
  fontSize: "var(--fs-label)",
  lineHeight: 1.3,
  color: "var(--color-slate)",
} as const;

const summaryValueStyle = {
  fontSize: "var(--fs-body)",
  fontWeight: 600,
  color: "var(--color-ink)",
  fontVariantNumeric: "tabular-nums",
} as const;

const CreateNewPortfolio: React.FC = () => {
  const [formData, setFormData] = useState({
    portfolio_name: '',
    port_type: '',
    target_ratio: {} as Record<string, number>,
    current_nav: null,
    cash_buffer_limit: 0,
    broker_id: null as number | null,
    product_ticker: '',
    x_amount: 0,
    initial_capital: 0,
    available_cash: 0,
    trade_plan_md: '',
    tags: {} as Record<string, boolean>,
    // Custom portfolio connection
    db_host: '',
    db_port: 5432,
    db_name: '',
    db_user: '',
    db_password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{ok: boolean; message: string} | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [targetRatioStr, setTargetRatioStr] = useState<string>('');
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api.getBrokers()
      .then((rows) => { if (!cancelled) setBrokers(rows); })
      .catch((err) => console.error('Failed to load brokers:', err));
    api.getAssets()
      .then((rows) => {
        if (cancelled) return;
        setTickers(Array.from(new Set(rows.map((a) => a.ticker).filter(Boolean))));
      })
      .catch((err) => console.error('Failed to load asset tickers:', err));
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (name === 'port_type' && value === 'Managed Fund') {
      setTargetRatioStr(
        Object.keys(formData.target_ratio).length > 0
          ? JSON.stringify(formData.target_ratio, null, 2)
          : ''
      );
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? null : parseFloat(value),
    }));
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const result = await api.testConnection({
        db_host: formData.db_host,
        db_port: formData.db_port,
        db_name: formData.db_name,
        db_user: formData.db_user,
        db_password: formData.db_password,
      });
      setConnectionStatus({ ok: true, message: result.message || 'Connection successful' });
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionStatus({ ok: false, message: "Couldn't test the connection. Try again." });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: PortfolioPayload = {
        portfolio_name: formData.portfolio_name,
        port_type: formData.port_type,
        target_ratio: formData.target_ratio,
        current_nav: formData.current_nav,
        cash_buffer_limit: Number(formData.cash_buffer_limit) || 0,
        available_cash: Number(formData.available_cash) || 0,
        broker_id: formData.broker_id ?? null,
        product_ticker: formData.product_ticker.trim() || null,
        x_amount: Number(formData.x_amount) || 0,
        initial_capital: Number(formData.initial_capital) || 0,
        trade_plan_md: formData.trade_plan_md,
        tags: formData.tags,
        db_host: formData.db_host,
        db_port: formData.db_port,
        db_name: formData.db_name,
        db_user: formData.db_user,
        db_password: formData.db_password,
      };
      if (formData.port_type === 'Managed Fund' && targetRatioStr.trim()) {
        const parsed = parseTargetRatios(targetRatioStr);
        if (parsed) {
          const vals = Object.values(parsed);
          if (vals.length > 0 && Math.max(...vals) <= 1) {
            for (const k of Object.keys(parsed)) parsed[k] = parsed[k] * 100;
          }
          payload.target_ratio = parsed;
        } else {
          payload.target_ratio = {};
        }
      }
      // Remove empty connection fields for non-custom portfolios
      if (formData.port_type !== 'Custom Portfolio') {
        delete payload.db_host;
        delete payload.db_port;
        delete payload.db_name;
        delete payload.db_user;
        delete payload.db_password;
      }
      await api.createPortfolio(payload);
      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Failed to create portfolio:', err);
      setError("Couldn't create the portfolio. Try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <PageLayout>
        <div className="max-w-3xl">
          <PageHeader title="Portfolio created" />
          <div style={panelStyle}>
            <p style={{ margin: "0 0 24px", fontSize: "var(--fs-content)", color: "var(--color-ink)" }}>
              Your new portfolio "{formData.portfolio_name}" has been created.
            </p>
            <div
              className="animate-pulse"
              style={{
                display: "inline-block",
                padding: "var(--space-sm)",
                borderRadius: "var(--rounded-full)",
                background: "var(--color-teal-light)",
                color: "var(--color-positive-text)",
                fontSize: "var(--fs-content)",
                fontWeight: 600,
              }}
            >
              Redirecting to portfolio overview...
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const submitDisabled = loading || !formData.portfolio_name || !formData.port_type;
  const testDisabled =
    testingConnection || !formData.db_host || !formData.db_name || !formData.db_user || !formData.db_password;

  const submitStyle: React.CSSProperties = submitDisabled
    ? {
        ...CONTROL_BUTTON_SECONDARY,
        background: "var(--color-surface)",
        color: "var(--color-slate)",
        cursor: "not-allowed",
      }
    : CONTROL_BUTTON_PRIMARY;

  const hasConnectionLine =
    formData.port_type === 'Custom Portfolio' && Boolean(formData.db_host);

  return (
    <PageLayout>
      <button
        onClick={() => navigate('/')}
        className="text-slate hover:text-ink transition-colors"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          padding: 0,
          marginBottom: 6,
          fontSize: "var(--fs-label)",
          fontWeight: 500,
          color: "var(--color-slate)",
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">←</span> Back to Overview
      </button>

      <PageHeader title="Create New Portfolio" />

      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]"
        style={{ gap: 20, alignItems: "start" }}
      >
        <div
          style={{
            ...panelStyle,
            boxSizing: "border-box",
            borderRight: "1px solid var(--color-hairline-soft)",
            paddingRight: "var(--space-lg)",
          }}
        >
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--rounded-md)",
                background: "var(--color-coral-light)",
                color: "var(--color-danger-text)",
                fontSize: "var(--fs-body)",
              }}
            >
              {error}
            </div>
          )}

          <form id="create-portfolio-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            {/* Portfolio Name */}
            <div>
              <label style={CONTROL_LABEL} htmlFor="portfolio_name">
                Portfolio Name*
              </label>
              <input
                id="portfolio_name"
                type="text"
                name="portfolio_name"
                value={formData.portfolio_name || ''}
                onChange={handleChange}
                required
                style={CONTROL_INPUT}
                placeholder="Enter portfolio name (e.g., 'Crypto Growth Fund')"
              />
            </div>

            {/* Port Type Selection */}
            <div>
              <label style={CONTROL_LABEL}>Portfolio Type*</label>
              <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
                {PORT_TYPES.map((type) => {
                  const selected = formData.port_type === type;
                  return (
                    <label
                      key={type}
                      className={`relative cursor-pointer flex flex-col items-center text-center border-2 transition-colors focus-within:border-ink ${
                        selected
                          ? 'border-ink bg-surface'
                          : 'border-hairline bg-canvas hover:border-slate'
                      }`}
                      style={{
                        padding: "var(--space-sm) var(--space-sm) var(--space-md)",
                        borderRadius: "var(--rounded-lg)",
                        gap: 4,
                      }}
                    >
                      <input
                        type="radio"
                        name="port_type"
                        value={type}
                        checked={selected}
                        onChange={handleChange}
                        className="absolute left-0 top-0 w-0 h-0 opacity-0"
                      />
                      {selected && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            top: "var(--space-xs)",
                            right: "var(--space-xs)",
                            width: "calc(var(--space-sm) + var(--control-pad-y))",
                            height: "calc(var(--space-sm) + var(--control-pad-y))",
                            borderRadius: "var(--rounded-full)",
                            background: "var(--color-ink)",
                            color: "var(--color-canvas)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                      <div style={{ color: "var(--color-ink)" }}>
                        <PortTypeIcon type={type} size={26} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--color-ink)" }}>
                        {type}
                      </h3>
                      <p style={{ margin: 0, fontSize: "var(--fs-caption)", lineHeight: 1.35, color: "var(--color-slate)" }}>
                        {PORT_TYPE_DESCRIPTIONS[type]}
                      </p>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Portfolio Connection Details */}
            {formData.port_type === 'Custom Portfolio' && (
              <div style={ruleStyle}>
                <h3 style={groupHeadStyle}>External Database Connection</h3>
                <p style={{ ...CONTROL_HELPER, margin: "4px 0 12px" }}>
                  All transactional data (orders, transactions, assets) is stored in this external PostgreSQL database.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
                  <div>
                    <label style={CONTROL_LABEL} htmlFor="db_host">Host *</label>
                    <input
                      id="db_host"
                      type="text"
                      name="db_host"
                      value={formData.db_host || ''}
                      onChange={handleChange}
                      required
                      style={CONTROL_INPUT}
                      placeholder="e.g. 192.168.1.100 or db.example.com"
                    />
                  </div>
                  <div>
                    <label style={CONTROL_LABEL} htmlFor="db_port">Port</label>
                    <input
                      id="db_port"
                      type="number"
                      name="db_port"
                      value={formData.db_port ?? 5432}
                      onChange={handleNumberChange}
                      style={CONTROL_INPUT}
                      placeholder="5432"
                    />
                  </div>
                  <div>
                    <label style={CONTROL_LABEL} htmlFor="db_name">Database Name *</label>
                    <input
                      id="db_name"
                      type="text"
                      name="db_name"
                      value={formData.db_name || ''}
                      onChange={handleChange}
                      required
                      style={CONTROL_INPUT}
                      placeholder="e.g. investment_custom_1"
                    />
                  </div>
                  <div>
                    <label style={CONTROL_LABEL} htmlFor="db_user">Username *</label>
                    <input
                      id="db_user"
                      type="text"
                      name="db_user"
                      value={formData.db_user || ''}
                      onChange={handleChange}
                      required
                      style={CONTROL_INPUT}
                      placeholder="e.g. dashboard"
                    />
                  </div>
                  <div>
                    <label style={CONTROL_LABEL} htmlFor="db_password">Password *</label>
                    <input
                      id="db_password"
                      type="password"
                      name="db_password"
                      value={formData.db_password || ''}
                      onChange={handleChange}
                      required
                      style={CONTROL_INPUT}
                      placeholder="Database password"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testDisabled}
                      className={`transition-opacity ${testDisabled ? 'opacity-50' : 'hover:opacity-90'}`}
                      style={{
                        ...CONTROL_BUTTON_SECONDARY,
                        height: "var(--control-h)",
                        cursor: testDisabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {testingConnection ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                </div>
                {connectionStatus && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "var(--space-xs) var(--space-sm)",
                      borderRadius: "var(--rounded-md)",
                      fontSize: "var(--fs-label)",
                      background: connectionStatus.ok
                        ? "var(--color-teal-light)"
                        : "var(--color-coral-light)",
                      color: connectionStatus.ok
                        ? "var(--color-positive-text)"
                        : "var(--color-danger-text)",
                    }}
                  >
                    {connectionStatus.ok ? '✓ ' : '✗ '}
                    {connectionStatus.message}
                  </div>
                )}
              </div>
            )}

            {/* Product, Capital & Risk Funds */}
            <div style={ruleStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: 12 }}>
                <div>
                  <h3 style={groupHeadStyle}>Product</h3>
                  <p style={{ ...CONTROL_HELPER, margin: "4px 0 0" }}>
                    Margin locked is computed from open orders — there is no manual margin input.
                  </p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 6, flex: "0 0 auto" }}>
                  <span style={{ ...CONTROL_LABEL, margin: 0 }}>Margin locked</span>
                  <span style={{ ...CONTROL_VALUE, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(0)}</span>
                </div>
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "minmax(0, 110px) minmax(0, 96px) minmax(0, 72px) minmax(0, 1fr)",
                  gap: "var(--space-md)",
                  alignItems: "start",
                }}
              >
                <div className="min-w-0">
                  <label style={CONTROL_LABEL} htmlFor="broker_id">Broker</label>
                  <div style={{ position: "relative" }}>
                    <select
                      id="broker_id"
                      name="broker_id"
                      value={formData.broker_id ?? ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        broker_id: e.target.value === '' ? null : Number(e.target.value),
                      }))}
                      style={{ ...CONTROL_INPUT, color: "transparent" }}
                    >
                      <option value="" style={{ color: "var(--color-ink)" }}>—</option>
                      {brokers.map(b => (
                        <option key={b.id} value={b.id} style={{ color: "var(--color-ink)" }}>{b.code} — {b.name}</option>
                      ))}
                    </select>
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: 9,
                        top: "50%",
                        transform: "translateY(-50%)",
                        maxWidth: "calc(100% - 26px)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "var(--fs-label)",
                        fontWeight: 500,
                        color: "var(--color-ink)",
                        pointerEvents: "none",
                      }}
                    >
                      {brokers.find(b => b.id === formData.broker_id)?.code ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <label style={CONTROL_LABEL} htmlFor="product_ticker">Product Ticker</label>
                  <input
                    id="product_ticker"
                    type="text"
                    name="product_ticker"
                    list="create-portfolio-tickers"
                    value={formData.product_ticker}
                    onChange={handleChange}
                    style={CONTROL_INPUT}
                    placeholder="e.g. S50"
                  />
                  <datalist id="create-portfolio-tickers">
                    {tickers.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div className="min-w-0">
                  <label style={CONTROL_LABEL} htmlFor="x_amount">Multiplier</label>
                  <AffixInput
                    id="x_amount"
                    type="number"
                    step="any"
                    name="x_amount"
                    value={formData.x_amount ?? ''}
                    onChange={handleNumberChange}
                    suffix="×"
                    placeholder="0"
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={CONTROL_LABEL} htmlFor="tag_input">
                    Metadata Tags (Market/Broker)
                  </label>
                  <div className="flex" style={{ gap: "var(--space-xs)", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      id="tag_input"
                      type="text"
                      placeholder="Add tag…"
                      title="Add tag (e.g., Crypto, Binance, TFEX)..."
                      onKeyDown={(e) => {
                        const target = e.target as HTMLInputElement;
                        if (e.key === 'Enter' && target.value.trim()) {
                          const tag = target.value.trim();
                          setFormData(prev => {
                            const newTags = { ...(prev.tags || {}), [tag]: true };
                            return { ...prev, tags: newTags };
                          });
                          target.value = '';
                        }
                      }}
                      style={{ ...CONTROL_INPUT, width: "auto", flex: "0 1 140px", minWidth: 100, maxWidth: 140 }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (input && input.value.trim()) {
                          const tag = input.value.trim();
                          setFormData(prev => {
                            const newTags = { ...(prev.tags || {}), [tag]: true };
                            return { ...prev, tags: newTags };
                          });
                          input.value = '';
                        }
                      }}
                      className="transition-colors"
                      style={{
                        ...CONTROL_BUTTON_SECONDARY,
                        height: "var(--control-h)",
                        flex: "0 0 auto",
                        cursor: "pointer",
                      }}
                    >
                      Add Tag
                    </button>
                    {Object.keys(formData.tags || {}).map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "var(--control-btn-pad-y) var(--control-btn-pad-x)",
                          borderRadius: "var(--rounded-full)",
                          fontSize: "var(--fs-label)",
                          fontWeight: 500,
                          background: "var(--color-teal-light)",
                          color: "var(--color-positive-text)",
                        }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => {
                              const newTags = { ...(prev.tags || {}) };
                              delete newTags[tag];
                              return { ...prev, tags: newTags };
                            });
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            fontSize: "var(--fs-label)",
                            lineHeight: 1,
                            color: "inherit",
                            cursor: "pointer",
                            opacity: 0.7,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <p style={CONTROL_HELPER}>
                    Tags help categorize your portfolio by market, broker, or strategy type.
                  </p>
                </div>
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns: "minmax(0, 150px) minmax(0, 150px) minmax(0, 110px)",
                  gap: "var(--space-md)",
                  marginTop: "var(--space-md)",
                }}
              >
                <div className="min-w-0">
                  <label style={CONTROL_LABEL} htmlFor="available_cash">Available Cash</label>
                  <AffixInput
                    id="available_cash"
                    type="number"
                    name="available_cash"
                    value={formData.available_cash !== null && formData.available_cash !== undefined ? formData.available_cash : ''}
                    onChange={handleNumberChange}
                    prefix="$"
                    placeholder="0.00"
                  />
                </div>
                <div className="min-w-0">
                  <label style={CONTROL_LABEL} htmlFor="initial_capital">Initial Capital</label>
                  <AffixInput
                    id="initial_capital"
                    type="number"
                    step="any"
                    name="initial_capital"
                    value={formData.initial_capital !== null && formData.initial_capital !== undefined ? formData.initial_capital : ''}
                    onChange={handleNumberChange}
                    prefix="$"
                    placeholder="0.00"
                  />
                  <p style={CONTROL_HELPER}>Baseline for the profit share, not the cash balance.</p>
                </div>
                <div className="min-w-0">
                  <label style={CONTROL_LABEL} htmlFor="cash_buffer_limit">Cash Buffer Limit</label>
                  <AffixInput
                    id="cash_buffer_limit"
                    type="number"
                    name="cash_buffer_limit"
                    value={formData.cash_buffer_limit !== null && formData.cash_buffer_limit !== undefined ? formData.cash_buffer_limit : ''}
                    onChange={handleNumberChange}
                    prefix="$"
                    placeholder="0.00"
                  />
                </div>
              </div>

            </div>

            {/* Target Ratio (for Managed Funds) */}
            {formData.port_type === 'Managed Fund' && (
              <div>
                <label style={CONTROL_LABEL} htmlFor="target_ratio">
                  Target Allocation Ratio (JSON format)
                </label>
                <textarea
                  id="target_ratio"
                  name="target_ratio"
                  value={targetRatioStr}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTargetRatioStr(raw);
                    const parsed = parseTargetRatios(raw);
                    if (parsed) setFormData(prev => ({ ...prev, target_ratio: parsed }));
                    // Allow free typing; parsed state stays at last valid value
                  }}
                  style={{
                    ...CONTROL_INPUT,
                    minHeight: 72,
                    resize: "vertical",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                  placeholder='{"BTC": 0.4, "ETH": 0.3, "USDC": 0.3}'
                />
                <p style={CONTROL_HELPER}>
                  Example: {'{"BTC": 0.4, "ETH": 0.3, "USDC": 0.3}'}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Live preview / summary rail */}
        <aside style={railStyle} aria-label="Portfolio preview">
          <div style={cardStyle}>
          <p style={eyebrowStyle}>Live preview</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "var(--space-xl)",
                height: "var(--space-xl)",
                borderRadius: "var(--control-radius)",
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                flex: "0 0 auto",
              }}
            >
              <PortTypeIcon type={formData.port_type} size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-content)",
                  fontWeight: 600,
                  color: "var(--color-ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {formData.portfolio_name || 'Portfolio Name'}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--fs-label)", color: "var(--color-slate)" }}>
                {formData.port_type || 'Select portfolio type'}
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 2,
              borderTop: "1px solid var(--color-hairline)",
              marginTop: 6,
              paddingTop: 4,
            }}
          >
            <p style={summaryRowStyle}>
              <span>Available cash</span>
              <span style={summaryValueStyle}>{fmtMoney(formData.available_cash)}</span>
            </p>
            <p style={summaryRowStyle}>
              <span>Initial capital</span>
              <span style={summaryValueStyle}>{fmtMoney(formData.initial_capital)}</span>
            </p>
            <p style={summaryRowStyle}>
              <span>Cash buffer</span>
              <span style={summaryValueStyle}>{fmtMoney(formData.cash_buffer_limit)}</span>
            </p>
            <p style={summaryRowStyle}>
              <span>Multiplier</span>
              <span style={summaryValueStyle}>
                {Number(formData.x_amount) || 0}
                <span style={{ color: "var(--color-slate)", fontWeight: 400 }}> ×</span>
              </span>
            </p>
          </div>

          {hasConnectionLine && (
            <p style={{ margin: "12px 0 0", fontSize: "var(--fs-label)", lineHeight: 1.45, color: "var(--color-slate)" }}>
              <svg className="w-3 h-3 inline-block align-middle mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {formData.db_host}:{formData.db_port}/{formData.db_name}
            </p>
          )}

          {formData.trade_plan_md && (
            <p
              style={{
                margin: "12px 0 0",
                fontSize: "var(--fs-label)",
                lineHeight: 1.45,
                color: "var(--color-slate)",
                fontStyle: "italic",
              }}
            >
              “{formData.trade_plan_md.substring(0, 80)}
              {formData.trade_plan_md.length > 80 ? '…' : ''}”
            </p>
          )}
          </div>

          <div style={cardStyle}>
            <label style={CONTROL_LABEL} htmlFor="trade_plan_md">
              Trade Plan / Strategy Notes (Optional)
            </label>
            <textarea
              id="trade_plan_md"
              name="trade_plan_md"
              value={formData.trade_plan_md || ''}
              onChange={handleChange}
              style={{
                ...CONTROL_INPUT,
                minHeight: 56,
                resize: "vertical",
                overflow: "auto",
                background: "var(--color-yellow-light)",
                border: "1px solid var(--color-brand-yellow)",
              }}
              placeholder="Enter your trading strategy or rules here... (e.g., 'Never hold more than 30 days', 'Focus on premium collection')"
            ></textarea>
            <p style={CONTROL_HELPER}>
              Visualized as a sticky note — for recording your investment intentions.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
              <button
                type="button"
                onClick={() => navigate('/')}
                disabled={loading}
                className="hover:bg-surface transition-colors"
                style={{
                  ...CONTROL_BUTTON_SECONDARY,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-portfolio-form"
                disabled={submitDisabled}
                className="transition-colors"
                style={submitStyle}
              >
                {loading ? 'Creating Portfolio...' : 'Create Portfolio'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </PageLayout>
  );
};

export default CreateNewPortfolio;
