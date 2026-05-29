import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? null : parseFloat(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/v1/portfolios/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setSuccess(true);
      // Redirect to portfolio overview after a short delay
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
          <p className="text-lg text-gray-600 mb-8">
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
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to Overview
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-200 p-4 mb-6 rounded-r-lg">
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
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Enter portfolio name (e.g., 'Crypto Growth Fund')"
            />
          </div>

          {/* Port Type Selection - Card-based as per UI spec */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Portfolio Type*
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[['Managed Fund', '₿', 'Focus on portfolio rebalancing according to target ratios.'],
                ['Active Trading', '📈', 'Manage individual orders (stocks, futures, options).'],
                ['Spread Strategy', '💱', 'Pair trades 1:1 and track spread values.']].map(([type, icon, description], index) => (
                <label
                  key={index}
                  className={`relative cursor-select flex flex-col items-center p-4 border-2 
                           ${formData.port_type === type ? 'border-primary bg-primary/5' : 'border-dashed border-gray-300 bg-gray-50'}
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
                  <div className="text-2xl mb-2">{icon}</div>
                  <h3 className="font-semibold text-gray-800">{type}</h3>
                  <p className="text-xs text-gray-500 text-center">{description}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Initial Funding Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Funding (Base Currency)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Available Cash</label>
                  <input
                    type="number"
                    name="available_cash"
                    value={formData.available_cash !== null && formData.available_cash !== undefined ? formData.available_cash : ''}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Money Market (T+3)</label>
                  <input
                    type="number"
                    name="money_market"
                    value={formData.money_market !== null && formData.money_market !== undefined ? formData.money_market : ''}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Margin Locked</label>
                  <input
                    type="number"
                    name="margin_locked"
                    value={formData.margin_locked !== null && formData.margin_locked !== undefined ? formData.margin_locked : ''}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cash Buffer Limit</label>
                  <input
                    type="number"
                    name="cash_buffer_limit"
                    value={formData.cash_buffer_limit !== null && formData.cash_buffer_limit !== undefined ? formData.cash_buffer_limit : ''}
                    onChange={handleNumberChange}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
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
                value={formData.target_ratio ? JSON.stringify(formData.target_ratio, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setFormData(prev => ({ ...prev, target_ratio: parsed }));
                  } catch (err) {
                    // Keep previous valid value if JSON is invalid
                    // In a real app, you might want to show validation error
                  }
                }}
                className="w-full min-h-[80px] px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent resize-y"
                placeholder='{"BTC": 0.4, "ETH": 0.3, "USDC": 0.3}'
              >
              </textarea>
              <p className="text-xs text-gray-500 mt-1">
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
              className="w-full min-h-[100px] px-4 py-3 bg-yellow-50 border-l-4 border-yellow-200 rounded-lg focus:outline-none focus:ring-2 focus-ring-yellow focus:border-transparent resize-y"
              placeholder="Enter your trading strategy or rules here... (e.g., 'Never hold more than 30 days', 'Focus on premium collection')"
            ></textarea>
            <p className="text-xs text-gray-500 mt-1">
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
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-l-xl focus:outline-none focus:ring-2 focus-ring-primary focus:border-transparent"
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
            <p className="text-xs text-gray-500 mt-1">
              Tags help categorize your portfolio by market, broker, or strategy type
            </p>
          </div>

          {/* Live Preview Card (as per UI spec) */}
          <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Live Preview</h2>
            <div className="flex items-start space-x-4">
              <div className="text-4xl">{formData.port_type === 'Managed Fund' ? '₿' : formData.port_type === 'Active Trading' ? '📈' : '💱'}</div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">{formData.portfolio_name || 'Portfolio Name'}</h3>
                <p className="text-sm text-gray-500">{formData.port_type || 'Select portfolio type'} · 
                  ${((formData.available_cash || 0) + (formData.money_market || 0)).toFixed(2)} Available</p>
                {formData.trade_plan_md && (
                  <p className="text-xs text-gray-400 italic mt-1">"{formData.trade_plan_md.substring(0, 30)}..."</p>
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
                         ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
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