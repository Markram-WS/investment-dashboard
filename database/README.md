# Investment Dashboard – Database Schemas

Two PostgreSQL databases power the system, plus user-configured external PostgreSQL databases for Custom Portfolios.

---

## Main DB (`investment_main`) — `main_db_schema.sql`

14 tables for portfolio management, trade execution, ledger, asset tracking, and custom portfolio connections:

| Table | Purpose |
|-------|---------|
| `portfolios` | Portfolio config: name, type, `is_custom` flag, cash fields (`available_cash`, `money_market`, `margin_locked`, `cash_buffer_limit`), `risk_status`, `tags` (JSONB), `internal_notes`, `trade_plan_md` |
| `custom_portfolio_connections` | Encrypted credentials for external DBs: `portfolio_id` FK, `db_host`, `db_port`, `db_name`, `db_user`, `encrypted_password` (Fernet) |
| `portfolio_nav_history` | NAV time-series per portfolio |
| `trade_plans` | Per-portfolio trade plan: entry/exit zones, leverage, margin rate, TP/SL levels |
| `option_details` | Greeks & pricing: strike, premium, delta, IV, theta, gamma, vega, rho |
| `active_orders` | Open positions: `order_id` TEXT (UUID), `group_id` FK→`orders_groups`, `linked_order_id` TEXT, `contract_type` (spot/future/option), `option_type` (Call/Put), `side` (BUY/SELL/LONG/SHORT), `expiry_date`, `strike_price`, `cost` |
| `simulation_models` | Draft rebalance/simulation data per portfolio |
| `trade_history` | Closed/canceled order records: `order_id`, `close_order_id`, `group_id`, `realized_pl`, `exit_price` |
| `orders_groups` | Group definitions: `name`, `max_orders`, `min_price`, `max_price`, `range` (was Zone Groups) |
| `whitelist_assets` | Approved asset tickers — extended with: `name`, `source` (yfinance/manual), `group_id` FK→`asset_groups`, `price` NUMERIC, `change_24h` NUMERIC, `updated_at` TIMESTAMP |
| `watchlist` | Price alerts per ticker |
| `transactions` | Consolidated ledger: deposits, withdrawals, transfers |
| `decision_journals` | Mini post-it notes per portfolio, linked to trade history |
| `asset_groups` | Group definitions for asset organization: `id` SERIAL PK, `name` TEXT UNIQUE NOT NULL, `is_default` BOOLEAN, `created_at` TIMESTAMP. Seeds Ungrouped + Watchlist on first query |

### New table: `custom_portfolio_connections`

```sql
CREATE TABLE custom_portfolio_connections (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER UNIQUE NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
  db_host TEXT NOT NULL,
  db_port INTEGER DEFAULT 5432,
  db_name TEXT NOT NULL,
  db_user TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

- `encrypted_password` is encrypted with Fernet (`FERNET_KEY` env var), never stored in plaintext
- One record per custom portfolio (enforced by UNIQUE constraint)
- Used by the dynamic engine manager to create on-demand `AsyncEngine` instances

### Updated column on `portfolios`

- `is_custom BOOLEAN DEFAULT FALSE` — flags whether data routes to an external database

### Updated columns on `whitelist_assets`

- `asset_id` SERIAL PK
- `ticker` TEXT NOT NULL — symbol (e.g., AAPL, BTC-USD, PTT.BK)
- `asset_type` TEXT — stock, future, option, crypto
- `name` TEXT — human-readable name
- `source` TEXT — `'yfinance'` or `'manual'`
- `group_id` INTEGER FK → `asset_groups(id)` — nullable
- `price` NUMERIC(20,8) — latest known price
- `change_24h` NUMERIC(20,8) — 24h change percentage
- `updated_at` TIMESTAMP — last price fetch time
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

---

## Custom Portfolio – External DB (Data Plane)

When a portfolio has `is_custom = True`, its transactional data is stored on a **separate PostgreSQL database** managed by the user. These tables are FK-free copies of the main DB tables:

| Table | Purpose |
|-------|---------|
| `active_orders` | Same columns as main, but `portfolio_id` is plain Integer (no FK) |
| `transactions` | Same columns as main, but `source_portfolio_id`/`destination_portfolio_id` are plain Integer |
| `trade_plans` | Same columns as main, `plan_id` is plain Integer (no FK) — added to avoid `ForeignKeyViolationError` on order creation referencing main-DB plan IDs |
| `whitelist_assets` | Same columns as main, but `group_id` is plain Integer (no FK to main) |
| `asset_groups` | Same columns as main |
| `orders_groups` | Same columns as main, `portfolio_id` is plain Integer |

Tables are created **lazily** — only on the first API request for that portfolio. Schema sync is isolated per database (no `metadata.create_all()` globals).

On first access, `ensure_custom_tables()` runs an auto-migration: it queries `information_schema.columns` for each table and runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for any columns missing from the external DB. It also **drops all existing FK constraints** via `ALTER TABLE ... DROP CONSTRAINT` to ensure the tables are FK-free (main-DB IDs like `plan_id`, `portfolio_id`, `group_id` don't exist in external DBs).

---

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
- Custom portfolio passwords are encrypted with Fernet using `FERNET_KEY` env var
- `is_custom` is migrated via `ALTER TABLE` in the FastAPI lifespan handler
- `custom_portfolio_connections` is created by `Base.metadata.create_all` on startup

---

*Last updated: 8 June 2026 (added trade_plans to external DB tables; ensure_custom_tables FK dropping + ALTER TABLE auto-migration)*
