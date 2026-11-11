import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import PageLayout from '../components/PageLayout';
import PageHeader from '../components/PageHeader';

const panelStyle = {
  background: "var(--color-canvas)",
  borderRadius: 16,
  padding: 24,
} as const;

const labelStyle = {
  display: "block",
  margin: 0,
  marginBottom: 8,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-slate)",
} as const;

const subLabelStyle = { ...labelStyle, marginBottom: 6 } as const;

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 15,
  color: "var(--color-ink)",
  background: "var(--color-canvas)",
  border: "1px solid var(--color-hairline)",
  borderRadius: 8,
  padding: "10px 12px",
} as const;

const helperStyle = {
  margin: "6px 0 0",
  fontSize: 12,
  color: "var(--color-slate)",
} as const;

const groupHeadStyle = {
  margin: 0,
  fontSize: 15,
  fontWeight: 600,
  color: "var(--color-ink)",
} as const;

const ruleStyle = {
  borderTop: "1px solid var(--color-hairline)",
  paddingTop: 16,
} as const;

const CreateNewPortfolio: React.FC = () => {
  const [formData, setFormData] = useState({
    portfolio_name: '',
    port_type: '',
    target_ratio: {} as any,
    current_nav: null,
    margin_locked: 0,
    cash_buffer_limit: 0,
    available_cash: 0,
    trade_plan_md: '',
    tags: {} as any,
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
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setConnectionStatus({ ok: false, message: msg });
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
      const payload: any = { ...formData };
      if (formData.port_type === 'Managed Fund' && targetRatioStr.trim()) {
        try {
          const parsed = JSON.parse(targetRatioStr);
          const vals = Object.values(parsed).filter((v): v is number => typeof v === 'number');
          if (vals.length > 0 && Math.max(...vals) <= 1) {
            for (const k of Object.keys(parsed)) parsed[k] = parsed[k] * 100;
          }
          payload.target_ratio = parsed;
        } catch { payload.target_ratio = {}; }
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
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <PageLayout>
        <div className="max-w-3xl">
          <PageHeader title="Portfolio created" />
          <div style={panelStyle}>
            <p style={{ margin: "0 0 24px", fontSize: 15, color: "var(--color-ink)" }}>
              Your new portfolio "{formData.portfolio_name}" has been created.
            </p>
            <div
              className="animate-pulse"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: 9999,
                background: "var(--color-teal-light)",
                color: "var(--color-positive-text)",
                fontSize: 15,
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

  return (
    <PageLayout>
      <div className="max-w-3xl">
        <PageHeader
          title="Create New Portfolio"
          meta={
            <button
              onClick={() => navigate('/')}
              className="text-slate hover:text-ink transition-colors"
              style={{ background: "none", border: "none", padding: 0, fontSize: 14, cursor: "pointer" }}
            >
              ← Back to Overview
            </button>
          }
        />

        <div style={panelStyle}>
          {error && (
            <div
              style={{
                marginBottom: 24,
                padding: "12px 16px",
                borderRadius: 8,
                background: "var(--color-coral-light)",
                color: "var(--color-danger-text)",
                fontSize: 15,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 24 }}>
            {/* Portfolio Name */}
            <div>
              <label style={labelStyle} htmlFor="portfolio_name">
                Portfolio Name &amp; Identity
              </label>
              <input
                id="portfolio_name"
                type="text"
                name="portfolio_name"
                value={formData.portfolio_name || ''}
                onChange={handleChange}
                required
                style={fieldStyle}
                placeholder="Enter portfolio name (e.g., 'Crypto Growth Fund')"
              />
            </div>

            {/* Port Type Selection - Card-based as per UI spec */}
            <div>
              <label style={labelStyle}>Portfolio Type*</label>
              <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 16 }}>
                {(['Managed Fund', 'Active Trading', 'Custom Portfolio'] as const).map((type) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    'Managed Fund': (
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="20" x2="12" y2="10" />
                        <line x1="18" y1="20" x2="18" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="16" />
                      </svg>
                    ),
                    'Active Trading': (
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    ),
                    'Custom Portfolio': (
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                      </svg>
                    ),
                  };
                  const descMap: Record<string, string> = {
                    'Managed Fund': 'Focus on portfolio rebalancing according to target ratios.',
                    'Active Trading': 'Manage individual orders (stocks, futures, options).',
                    'Custom Portfolio': 'Isolated external database for orders, transactions, and assets.',
                  };
                  const selected = formData.port_type === type;
                  return (
                  <label
                    key={type}
                    className={`relative cursor-pointer flex flex-col items-center border-2 transition-colors text-center ${
                      selected
                        ? 'border-brand-teal bg-teal-light'
                        : 'border-dashed border-hairline hover:border-brand-teal'
                    }`}
                    style={{ padding: 16, borderRadius: 12, gap: 6 }}
                  >
                    <input
                      type="radio"
                      name="port_type"
                      value={type}
                      checked={selected}
                      onChange={handleChange}
                      className="absolute left-0 top-0 w-0 h-0 opacity-0"
                    />
                    <div style={{ color: "var(--color-ink)" }}>{iconMap[type]}</div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>
                      {type}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-slate)" }}>{descMap[type]}</p>
                  </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Portfolio Connection Details */}
            {formData.port_type === 'Custom Portfolio' && (
              <div style={ruleStyle}>
                <h3 style={groupHeadStyle}>External Database Connection</h3>
                <p style={{ margin: "6px 0 16px", fontSize: 12, color: "var(--color-slate)" }}>
                  All transactional data (orders, transactions, assets) will be stored on this external PostgreSQL database.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
                  <div>
                    <label style={subLabelStyle} htmlFor="db_host">Host *</label>
                    <input
                      id="db_host"
                      type="text"
                      name="db_host"
                      value={formData.db_host || ''}
                      onChange={handleChange}
                      required
                      style={fieldStyle}
                      placeholder="e.g. 192.168.1.100 or db.example.com"
                    />
                  </div>
                  <div>
                    <label style={subLabelStyle} htmlFor="db_port">Port</label>
                    <input
                      id="db_port"
                      type="number"
                      name="db_port"
                      value={formData.db_port ?? 5432}
                      onChange={handleNumberChange}
                      style={fieldStyle}
                      placeholder="5432"
                    />
                  </div>
                  <div>
                    <label style={subLabelStyle} htmlFor="db_name">Database Name *</label>
                    <input
                      id="db_name"
                      type="text"
                      name="db_name"
                      value={formData.db_name || ''}
                      onChange={handleChange}
                      required
                      style={fieldStyle}
                      placeholder="e.g. investment_custom_1"
                    />
                  </div>
                  <div>
                    <label style={subLabelStyle} htmlFor="db_user">Username *</label>
                    <input
                      id="db_user"
                      type="text"
                      name="db_user"
                      value={formData.db_user || ''}
                      onChange={handleChange}
                      required
                      style={fieldStyle}
                      placeholder="e.g. dashboard"
                    />
                  </div>
                  <div>
                    <label style={subLabelStyle} htmlFor="db_password">Password *</label>
                    <input
                      id="db_password"
                      type="password"
                      name="db_password"
                      value={formData.db_password || ''}
                      onChange={handleChange}
                      required
                      style={fieldStyle}
                      placeholder="Database password"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testDisabled}
                      className={`text-white font-medium transition-opacity ${testDisabled ? 'opacity-50' : 'hover:opacity-90'}`}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 9999,
                        border: "none",
                        fontSize: 13,
                        background: "var(--color-brand-teal)",
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
                      marginTop: 12,
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontSize: 13,
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

            {/* Initial Funding Section */}
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 24 }}>
              <div>
                <label style={labelStyle}>Initial Funding (Base Currency)</label>
                <div className="grid grid-cols-2" style={{ gap: 16 }}>
                  <div>
                    <label style={subLabelStyle} htmlFor="available_cash">Available Cash</label>
                    <input
                      id="available_cash"
                      type="number"
                      name="available_cash"
                      value={formData.available_cash !== null && formData.available_cash !== undefined ? formData.available_cash : ''}
                      onChange={handleNumberChange}
                      style={{ ...fieldStyle, fontVariantNumeric: "tabular-nums" }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Risk Management Funds</label>
                <div className="grid grid-cols-2" style={{ gap: 16 }}>
                  <div>
                    <label style={subLabelStyle} htmlFor="margin_locked">Margin Locked</label>
                    <input
                      id="margin_locked"
                      type="number"
                      name="margin_locked"
                      value={formData.margin_locked !== null && formData.margin_locked !== undefined ? formData.margin_locked : ''}
                      onChange={handleNumberChange}
                      style={{ ...fieldStyle, fontVariantNumeric: "tabular-nums" }}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label style={subLabelStyle} htmlFor="cash_buffer_limit">Cash Buffer Limit</label>
                    <input
                      id="cash_buffer_limit"
                      type="number"
                      name="cash_buffer_limit"
                      value={formData.cash_buffer_limit !== null && formData.cash_buffer_limit !== undefined ? formData.cash_buffer_limit : ''}
                      onChange={handleNumberChange}
                      style={{ ...fieldStyle, fontVariantNumeric: "tabular-nums" }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Target Ratio (for Managed Funds) */}
            {formData.port_type === 'Managed Fund' && (
              <div>
                <label style={labelStyle} htmlFor="target_ratio">
                  Target Allocation Ratio (JSON format)
                </label>
                <textarea
                  id="target_ratio"
                  name="target_ratio"
                  value={targetRatioStr}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTargetRatioStr(raw);
                    try {
                      const parsed = JSON.parse(raw);
                      setFormData(prev => ({ ...prev, target_ratio: parsed }));
                    } catch {
                      // Allow free typing; parsed state stays at last valid value
                    }
                  }}
                  style={{
                    ...fieldStyle,
                    minHeight: 80,
                    resize: "vertical",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                  placeholder='{"BTC": 0.4, "ETH": 0.3, "USDC": 0.3}'
                />
                <p style={helperStyle}>
                  Example: {'{"BTC": 0.4, "ETH": 0.3, "USDC": 0.3}'}
                </p>
              </div>
            )}

            {/* Trade Plan (Markdown) - Sticky Note Style */}
            <div>
              <label style={labelStyle} htmlFor="trade_plan_md">
                Trade Plan / Strategy Notes (Optional)
              </label>
              <textarea
                id="trade_plan_md"
                name="trade_plan_md"
                value={formData.trade_plan_md || ''}
                onChange={handleChange}
                style={{
                  ...fieldStyle,
                  minHeight: 100,
                  resize: "vertical",
                  background: "var(--color-yellow-light)",
                  border: "1px solid var(--color-brand-yellow)",
                }}
                placeholder="Enter your trading strategy or rules here... (e.g., 'Never hold more than 30 days', 'Focus on premium collection')"
              ></textarea>
              <p style={helperStyle}>
                Visualized as a sticky note — for recording your investment intentions
              </p>
            </div>

            {/* Metadata Tags */}
            <div>
              <label style={labelStyle} htmlFor="tag_input">
                Metadata Tags (Market/Broker)
              </label>
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                <input
                  id="tag_input"
                  type="text"
                  placeholder="Add tag (e.g., Crypto, Binance, TFEX)..."
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
                  style={{ ...fieldStyle, width: "auto", flex: 1, minWidth: 220 }}
                />
                <button
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
                  className="text-white font-medium transition-opacity hover:opacity-90"
                  style={{
                    padding: "10px 18px",
                    borderRadius: 9999,
                    border: "none",
                    fontSize: 13,
                    background: "var(--color-brand-teal)",
                    cursor: "pointer",
                  }}
                >
                  Add Tag
                </button>
              </div>
              {(formData.tags || Object.keys(formData.tags).length > 0) && (
                <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
                  {Object.keys(formData.tags || {}).map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 9999,
                        fontSize: 12,
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
                          fontSize: 14,
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
              )}
              <p style={helperStyle}>
                Tags help categorize your portfolio by market, broker, or strategy type
              </p>
            </div>

            {/* Live Preview */}
            <div style={{ borderTop: "1px solid var(--color-hairline)", marginTop: 20, paddingTop: 16 }}>
              <p style={labelStyle}>Live Preview</p>
              <div className="flex items-start" style={{ gap: 16 }}>
                <div style={{ color: "var(--color-ink)" }}>{formData.port_type === 'Managed Fund' ? (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="20" x2="12" y2="10" />
                    <line x1="18" y1="20" x2="18" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="16" />
                  </svg>
                ) : formData.port_type === 'Active Trading' ? (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                ) : (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                )}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>
                    {formData.portfolio_name || 'Portfolio Name'}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 15,
                      color: "var(--color-ink)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <span style={{ color: "var(--color-slate)" }}>
                      {formData.port_type || 'Select portfolio type'}
                    </span>
                    <span style={{ marginLeft: 12 }}>
                      ${(formData.available_cash || 0).toFixed(2)} available
                    </span>
                  </p>
                  {formData.port_type === 'Custom Portfolio' && formData.db_host && (
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-brand-teal)" }}>
                      <svg className="w-3.5 h-3.5 inline-block align-middle mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      Connected to {formData.db_host}:{formData.db_port}/{formData.db_name}</p>
                  )}
                  {formData.trade_plan_md && (
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-slate)", fontStyle: "italic" }}>
                      "{formData.trade_plan_md.substring(0, 30)}..."
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ paddingTop: 4 }}>
              <button
                type="submit"
                disabled={submitDisabled}
                className={`w-full flex justify-center items-center font-medium text-white transition-opacity ${
                  submitDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                }`}
                style={{
                  padding: "14px 24px",
                  fontSize: 15,
                  borderRadius: 9999,
                  border: "none",
                  background: "var(--color-brand-teal)",
                  color: "var(--color-on-primary)",
                  opacity: submitDisabled ? 0.5 : 1,
                  cursor: submitDisabled ? "not-allowed" : "pointer",
                }}
              >
                {loading ? 'Creating Portfolio...' : 'Create Portfolio'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
};

export default CreateNewPortfolio;
