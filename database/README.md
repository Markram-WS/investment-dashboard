# Investment Dashboard – Database Schemas

Two PostgreSQL databases power the system:

## Main DB (`investment_main`) — `main_db_schema.sql`

13 tables for portfolio management, trade execution, ledger, and asset tracking:

| Table | Purpose |
|-------|---------|
| `portfolios` | Portfolio config: name, type, cash fields (`available_cash`, `money_market`, `margin_locked`, `cash_buffer_limit`), `risk_status`, `tags` (JSONB), `internal_notes`, `trade_plan_md` |
| `portfolio_nav_history` | NAV time-series per portfolio |
| `trade_plans` | Per-portfolio trade plan: entry/exit zones, leverage, margin rate, TP/SL levels |
| `option_details` | Greeks & pricing: strike, premium, delta, IV, theta, gamma, vega, rho |
| `active_orders` | Open positions: `order_id` TEXT (UUID), `group_id` FK→`orders_groups`, `linked_order_id` TEXT, `contract_type` (spot/future/option), `option_type` (Call/Put), `side` (BUY/SELL/LONG/SHORT), `expiry_date`, `strike_price`, `cost` |
| `simulation_models` | Draft rebalance/simulation data per portfolio |
| `trade_history` | Closed/canceled order records: `order_id`, `close_order_id`, `group_id`, `realized_pl`, `exit_price` |
| `orders_groups` | Group definitions: `name`, `max_orders`, `min_price`, `max_price`, `range` (was Zone Groups) |
| `whitelist_assets` | Approved asset tickers — **extended with**: `name`, `source` (yfinance/manual), `group_id` FK→`asset_groups`, `price` NUMERIC, `change_24h` NUMERIC, `updated_at` TIMESTAMP |
| `watchlist` | Price alerts per ticker |
| `transactions` | Consolidated ledger: deposits, withdrawals, transfers |
| `decision_journals` | Mini post-it notes per portfolio, linked to trade history |
| `asset_groups` | **NEW** — Group definitions for asset organization: `id` SERIAL PK, `name` TEXT UNIQUE NOT NULL, `is_default` BOOLEAN, `created_at` TIMESTAMP. Seeds Ungrouped + Watchlist on first query via asset_groups router |

### Updated columns on `whitelist_assets`

- `asset_id` SERIAL PK
- `ticker` TEXT NOT NULL — symbol (e.g., AAPL, BTC-USD, PTT.BK)
- `asset_type` TEXT — stock, future, option, crypto
- `name` TEXT — human-readable name (new)
- `source` TEXT — `'yfinance'` or `'manual'` (new)
- `group_id` INTEGER FK → `asset_groups(id)` — nullable (new)
- `price` NUMERIC(20,8) — latest known price (new)
- `change_24h` NUMERIC(20,8) — 24h change percentage (new)
- `updated_at` TIMESTAMP — last price fetch time (new)
- `added_at` TIMESTAMP — creation time

### New table: `asset_groups`

```sql
CREATE TABLE asset_groups (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

- Ungrouped and Watchlist are created as defaults on first API query
- Default groups cannot be deleted (enforced by backend)
- Frontend uses zone-style collapsible sections with droppable areas

### Key columns on `active_orders`

- `order_id TEXT PRIMARY KEY` — UUID string
- `linked_order_id TEXT` — one-way link or cross-link
- `group_id INTEGER FK → orders_groups(id)`
- `contract_type TEXT` — `'spot'`, `'future'`, or `'option'`
- `option_type TEXT` — `'Call'` or `'Put'`
- `side TEXT` — `'BUY'`/`'SELL'` (spot), `'LONG'`/`'SHORT'` (futures/options)
- `expiry_date TIMESTAMP`, `strike_price NUMERIC(20,8)`, `cost NUMERIC(20,8)`

## AI DB (`investment_ai`) — `ai_db_schema.sql`

3 tables for AI agent orchestration:

| Table | Purpose |
|-------|---------|
| `ai_agents` | Agent profiles: name, model, strategy config, target portfolio |
| `ai_action_logs` | Execution audit: SCAN/PLAN/EXECUTE/ADJUST actions |
| `ai_agent_state` | Runtime state: last run, current task, busy flag |

## Notes

- `portfolios.available_cash` is auto-adjusted when Money Market/Margin Locked/Cash Buffer Limit change
- `AssetGroup` seeds Ungrouped + Watchlist on first query via the `asset_groups` router
- `WhitelistAssets` extended to include price tracking columns; `source` distinguishes yfinance vs manual
- Yfinance prices fetched via direct HTTP (not yfinance library) to avoid rate limiting
- Frontend caches last known price in `localStorage('cached_price_{ticker}')`
- `link_type` is NOT stored — computed server-side by `analytics.py._link_type()`
- Order status: `PENDING`, `FILLED` (non-terminal), `CLOSE`, `CANCELED` (terminal)
- Frontend Options Strategy state is per-portfolio in localStorage (6 `payoff_{key}_{pid}` keys)
- IV values for active orders are frontend-only (Controls panel, per-portfolio localStorage)

---

*Last updated: 7 June 2026 (added asset_groups table; updated whitelist_assets columns; yfinance direct HTTP)*
