import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const CreateNewPortfolio: React.FC = () => {
  const [formData, setFormData] = useState({
    portfolio_name: '',
    port_type: '',
    target_ratio: {} as any,
    current_nav: null,
    margin_locked: 0,
    cash_buffer_limit: 0,
    available_cash: 0,
    money_market: 0,
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
      <div className="min-h-screen bg-gradient-to-br from-cream-to-peach p-6">
        <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg text-center">
          <h1 className="text-3xl font-bold text-primary mb-6">Portfolio Created Successfully!</h1>
          <p className="text-lg text-ink mb-8">
            Your new portfolio "{formData.portfolio_name}" has been created.
          </p>
          <div className="animate-pulse inline-block bg-primary text-white px-6 py-3 rounded-full">
            Redirecting to portfolio overview...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-to-peach p-6">
      <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-3xl font-bold text-primary">Create New Portfolio</h1>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate hover:text-gray-700 transition-colors"
          >
            ← Back to Overview
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-l-2 border-red-200 dark:border-red-800 p-4 mb-6 rounded-r-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Portfolio Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Portfolio Name & Identity
            </label>
            <input
              type="text"
              name="portfolio_name"
              value={formData.portfolio_name || ''}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-surface border border-hairline rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Enter portfolio name (e.g., 'Crypto Growth Fund')"
            />
          </div>

          {/* Port Type Selection - Card-based as per UI spec */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Portfolio Type*
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                return (
                <label
                  key={type}
                  className={`relative cursor-select flex flex-col items-center p-4 border-2 
                           ${formData.port_type === type ? 'border-primary bg-primary/5' : 'border-dashed border-gray-300 bg-surface'}
                           hover:border-primary hover:bg-primary/2 transition-all rounded-xl`}
                >
                  <input
                    type="radio"
                    name="port_type"
                    value={type}
                    checked={formData.port_type === type}
                    onChange={handleChange}
                    className="absolute left-0 top-0 w-0 h-0 opacity-0"
                  />
                  <div className="mb-2">{iconMap[type]}</div>
                  <h3 className="font-semibold text-gray-800">{type}</h3>
                  <p className="text-xs text-slate text-center">{descMap[type]}</p>
                </label>
                );
              })}
            </div>
          </div>

          {/* Custom Portfolio Connection Details */}
          {formData.port_type === 'Custom Portfolio' && (
            <div className="p-6 bg-surface rounded-xl border border-hairline">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                External Database Connection
              </h3>
              <p className="text-xs text-slate mb-4">
                All transactional data (orders, transactions, assets) will be stored on this external PostgreSQL database.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Host *</label>
                  <input
                    type="text"
                    name="db_host"
                    value={formData.db_host || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g. 192.168.1.100 or db.example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Port</label>
                  <input
                    type="number"
                    name="db_port"
                    value={formData.db_port ?? 5432}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="5432"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Database Name *</label>
                  <input
                    type="text"
                    name="db_name"
                    value={formData.db_name || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g. investment_custom_1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Username *</label>
                  <input
                    type="text"
                    name="db_user"
                    value={formData.db_user || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g. dashboard"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Password *</label>
                  <input
                    type="password"
                    name="db_password"
                    value={formData.db_password || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Database password"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection || !formData.db_host || !formData.db_name || !formData.db_user || !formData.db_password}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                              ${testingConnection || !formData.db_host || !formData.db_name || !formData.db_user || !formData.db_password
                                ? 'bg-gray-300 text-slate cursor-not-allowed'
                                : 'bg-brand-teal text-white hover:bg-brand-teal/90'}
                              `}
                  >
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>
              {connectionStatus && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  connectionStatus.ok
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {connectionStatus.ok ? '✓ ' : '✗ '}
                  {connectionStatus.message}
                </div>
              )}
            </div>
          )}

          {/* Initial Funding Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Funding (Base Currency)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Available Cash</label>
                  <input
                    type="number"
                    name="available_cash"
                    value={formData.available_cash !== null && formData.available_cash !== undefined ? formData.available_cash : ''}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Money Market (T+3)</label>
                  <input
                    type="number"
                    name="money_market"
                    value={formData.money_market !== null && formData.money_market !== undefined ? formData.money_market : ''}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Management Funds
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Margin Locked</label>
                  <input
                    type="number"
                    name="margin_locked"
                    value={formData.margin_locked !== null && formData.margin_locked !== undefined ? formData.margin_locked : ''}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Cash Buffer Limit</label>
                  <input
                    type="number"
                    name="cash_buffer_limit"
                    value={formData.cash_buffer_limit !== null && formData.cash_buffer_limit !== undefined ? formData.cash_buffer_limit : ''}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Target Ratio (for Managed Funds) */}
          {formData.port_type === 'Managed Fund' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Allocation Ratio (JSON format)
              </label>
              <textarea
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
                className="w-full min-h-[80px] px-4 py-3 bg-surface border border-hairline rounded-xl focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent resize-y font-mono text-sm"
                placeholder='{"BTC": 0.4, "ETH": 0.3, "USDC": 0.3}'
              />
              <p className="text-xs text-slate mt-1">
                Example: {'{"BTC": 0.4, "ETH": 0.3, "USDC": 0.3}'}
              </p>
            </div>
          )}

          {/* Trade Plan (Markdown) - Sticky Note Style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trade Plan / Strategy Notes (Optional)
            </label>
            <textarea
              name="trade_plan_md"
              value={formData.trade_plan_md || ''}
              onChange={handleChange}
              className="w-full min-h-[100px] px-4 py-3 bg-yellow-50 border-l-2 border-yellow-200 dark:border-yellow-800 rounded-lg focus:outline-none focus:ring-2 focus-ring-yellow focus:border-transparent resize-y"
              placeholder="Enter your trading strategy or rules here... (e.g., 'Never hold more than 30 days', 'Focus on premium collection')"
            ></textarea>
            <p className="text-xs text-slate mt-1">
              Visualized as a sticky note - for recording your investment intentions
            </p>
          </div>

          {/* Metadata Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metadata Tags (Market/Broker)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
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
                className="flex-1 px-3 py-2 bg-surface border border-hairline rounded-l-xl focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
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
                className="bg-primary text-white px-4 py-2 rounded-r-xl hover:bg-primary/90 transition-colors"
              >
                Add Tag
              </button>
            </div>
            {(formData.tags || Object.keys(formData.tags).length > 0) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.keys(formData.tags || {}).map((tag, index) => (
                  <span
                    key={index}
                    className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-medium"
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
                      className="ml-2 text-primary/60 hover:text-primary/80"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate mt-1">
              Tags help categorize your portfolio by market, broker, or strategy type
            </p>
          </div>

          {/* Live Preview Card */}
          <div className="mt-8 p-6 bg-surface rounded-xl border border-hairline">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Live Preview</h2>
            <div className="flex items-start space-x-4">
              <div className="text-4xl">{formData.port_type === 'Managed Fund' ? (
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
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">{formData.portfolio_name || 'Portfolio Name'}</h3>
                <p className="text-sm text-slate">{formData.port_type || 'Select portfolio type'} · 
                  ${((formData.available_cash || 0) + (formData.money_market || 0)).toFixed(2)} Available</p>
                {formData.port_type === 'Custom Portfolio' && formData.db_host && (
                  <p className="text-xs text-brand-teal mt-1">
                    <svg className="w-3.5 h-3.5 inline-block align-middle mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Connected to {formData.db_host}:{formData.db_port}/{formData.db_name}</p>
                )}
                {formData.trade_plan_md && (
                  <p className="text-xs text-slate italic mt-1">"{formData.trade_plan_md.substring(0, 30)}..."</p>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || !formData.portfolio_name || !formData.port_type}
              className={`w-full flex justify-center items-center px-6 py-3 text-lg font-medium rounded-xl 
                       ${loading || !formData.portfolio_name || !formData.port_type
                         ? 'bg-gray-300 text-slate cursor-not-allowed'
                         : 'bg-primary text-white hover:bg-primary/90 transition-colors'}
                       `}
            >
              {loading ? 'Creating Portfolio...' : 'Create Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateNewPortfolio;
