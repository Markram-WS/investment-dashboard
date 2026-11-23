# Investment Dashboard – Database Schemas

Two PostgreSQL databases power the system, plus user-configured external PostgreSQL databases for Custom Portfolios.

## Managed Fund Tables (Main DB)

4 new tables added for the Managed Fund portfolio type (`port_type = "Managed Fund"`):

| Table | Purpose |
|-------|---------|
| `managed_fund_holdings` | Asset holdings: `holding_id` PK, `portfolio_id` FK→`portfolios`, `asset`, `qty`, `avg_entry_price`, `current_price`, `market_value`, `unrealized_pl`, `unrealized_pl_pct`, `profit_threshold` |
| `managed_fund_orders` | Orders in progress (pending): `order_id` PK, `portfolio_id` FK, `asset`, `side` (Buy/Sell), `qty`, `price`, `status` (pending→done/cancelled), `order_type`, `notes` |
| `managed_fund_order_history` | Completed/cancelled orders: same columns as orders + `executed_at` timestamp; moved here when order status changes to done/cancelled |
| `managed_fund_settings` | Per-portfolio settings: `id` PK, `portfolio_id` UNIQUE FK, `target_ratio` JSON (`{"BTC":40,"ETH":60}` in percentage), `global_profit_threshold`, `total_invested`, `last_rebalance_date` |

### Order Flow
```
Create Order (pending) → Confirm Done → Update Holdings + Adjust available_cash + Record NAV → Move to Order History
                       → Cancel       → Move to Order History (cancelled)
```

### Key behaviors
- `portfolio.available_cash` is auto-adjusted on order confirm: Buy→deduct, Sell→add
- `portfolio.current_nav` = `available_cash + sum(holding.qty × holding.current_price)`
- Buy orders merge into existing holdings (weighted avg entry price); Sell orders reduce qty or delete holding
- Order symbols auto-sync to `whitelist_assets` on creation with `source='manual'`
- target_ratio supports both decimal (0.4 = 40%) and percentage (40) input — auto-normalized to percentage on read
- Deleting a portfolio cascades to all `managed_fund_*` tables

---

## Main DB (`investment_main`) — `main_db_schema.sql`

18 tables for portfolio management, managed fund, trade execution, ledger, asset tracking, and custom portfolio connections:

| Table | Purpose |
|-------|---------|
| `portfolios` | Portfolio config: name, type, `is_custom` flag, cash fields (`available_cash`, `margin_locked`, `cash_buffer_limit`), `risk_status`, `tags` (JSONB), `internal_notes`, `trade_plan_md` |
| `custom_portfolio_connections` | Encrypted credentials for external DBs: `portfolio_id` FK, `db_host`, `db_port`, `db_name`, `db_user`, `encrypted_password` (Fernet), `mapping_config` (JSON, nullable — non-null makes the portfolio a read-only view over a foreign broker schema; null keeps the owned-tables mode) |
| `portfolio_nav_history` | NAV time-series per portfolio |
| `trade_plans` | Per-portfolio trade plan: entry/exit zones, leverage, margin rate, TP/SL levels |
| `option_details` | Greeks & pricing: strike, premium, delta, IV, theta, gamma, vega, rho |
| `active_orders` | Open positions: `order_id` TEXT (UUID), `group_id` FK→`orders_groups`, `linked_order_id` TEXT, `contract_type` (spot/future/option), `option_type` (Call/Put), `side` (BUY/SELL/LONG/SHORT), `expiry_date`, `strike_price`, `cost` |
| `simulation_models` | Draft rebalance/simulation data per portfolio |
| `trade_history` | Closed/canceled order records: `order_id`, `close_order_id`, `group_id`, `realized_pl`, `exit_price` |
| `orders_groups` | Group definitions: `name`, `max_orders`, `min_price`, `max_price`, `range` (was Zone Groups) |
| `whitelist_assets` | Approved asset tickers — extended with: `name`, `source` (yfinance/tfex/manual), `price_symbol` (provider symbol), `group_id` FK→`asset_groups`, `price` NUMERIC, `change_24h` NUMERIC, `updated_at` TIMESTAMP |
| `watchlist` | Price alerts per ticker |
| `transactions` | Consolidated ledger: deposits, withdrawals, transfers |
| `decision_journals` | Mini post-it notes per portfolio, linked to trade history |
| `asset_groups` | Group definitions for asset organization: `id` SERIAL PK, `name` TEXT UNIQUE NOT NULL, `is_default` BOOLEAN, `created_at` TIMESTAMP. Seeds Ungrouped + Watchlist on first query |
| `managed_fund_holdings` | Managed Fund: asset holdings with avg entry, current price, P/L, profit threshold |
| `managed_fund_orders` | Managed Fund: pending orders (Buy/Sell) before confirmation |
| `managed_fund_order_history` | Managed Fund: completed/cancelled order archive |
| `managed_fund_settings` | Managed Fund: target allocation ratios (JSON), profit thresholds, total invested |

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
  mapping_config JSON,
  created_at TIMESTAMP DEFAULT NOW()
);
```

- `encrypted_password` is encrypted with Fernet (`FERNET_KEY` env var), never stored in plaintext
- `mapping_config` is nullable: `NULL` means the legacy mode (the backend creates and owns its tables in the external DB); a JSON object is a read-through mapping over an existing broker schema — see *Mapped read-only mode* below
- One record per custom portfolio (enforced by UNIQUE constraint)
- Used by the dynamic engine manager to create on-demand `AsyncEngine` instances

### Updated column on `portfolios`

- `is_custom BOOLEAN DEFAULT FALSE` — flags whether data routes to an external database

### Updated columns on `whitelist_assets`

- `asset_id` SERIAL PK
- `ticker` TEXT NOT NULL — symbol (e.g., AAPL, BTC-USD, PTT.BK)
- `asset_type` TEXT — stock, future, option, crypto
- `name` TEXT — human-readable name
- `source` TEXT — `'yfinance'`, `'tfex'`, or `'manual'`; only the first two are fetched by the price-refresh endpoints
- `price_symbol` TEXT — provider symbol used for the price feed (same as `ticker` by default); may differ from the dashboard ticker and is stored as entered, never uppercased (e.g. `PTT.BK`)
- `group_id` INTEGER FK → `asset_groups(id)` — nullable
- `price` NUMERIC(20,8) — latest known price
- `change_24h` NUMERIC(20,8) — 24h change percentage
- `updated_at` TIMESTAMP — last price fetch time
- `added_at` TIMESTAMP — creation time

### Price sources and refresh

- `POST /api/v1/assets/{id}/update-price` and `POST /api/v1/assets/batch-update-prices` request the quote symbol as `price_symbol`, falling back to `ticker` when it is `NULL`/blank.
- `source = 'yfinance'` fetches from Yahoo Finance (direct HTTP, no `yfinance` library); `source = 'tfex'` fetches from the TFEX quotation API. `source = 'manual'` rows are never fetched and `update-price` only refreshes `updated_at`.
- **TFEX quotes are delayed** — the public quotation series endpoint (`/api/set/tfex/series/{symbol}/info`) returns the last traded price, not a live tick, so values lag the exchange by roughly 15 minutes. The client warms up the quotation page once for its anti-bot cookies and retries once before reporting failure. `price_symbol` accepts the series code or the TFEX product-page URL, and a halted or illiquid series with no last trade falls back to the bid/offer mid, settlement price, or prior settlement price.
- A TFEX fetch failure is returned as HTTP 502 with a fixed message: unknown/expired series symbol, no usable quote, or a blocked request. `batch-update-prices` skips individual failures and reports only the tickers it updated.
- Tickers created by `sync-from-orders` from a mapped (foreign-schema) portfolio are inserted with `source = 'tfex'` and `price_symbol = ticker`; non-mapped tickers get `source = 'yfinance'` there, while `sync-from-all` uses `source = 'manual'` for them.

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

When a portfolio has `is_custom = True`, its transactional data is stored on a **separate PostgreSQL database** managed by the user. In the default (owned-tables) mode these tables are FK-free copies of the main DB tables:

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

### Mapped read-only mode (`mapping_config`)

A non-null `custom_portfolio_connections.mapping_config` switches the same portfolio to a **read-through view** over a schema that already exists (a broker's database). The JSON is the contract; nothing about the foreign schema is assumed beyond what it declares.

- **Template** — `tfex-settrade-v1` (`TFEX / Settrade`), exposed by `GET /api/v1/portfolios/mapping-templates`. Select it on create or PATCH it onto an existing connection (`PATCH /api/v1/portfolios/{id}/connection`); a stored config is a snapshot and does not follow later template edits.
- **Connection editing** — the same `PATCH` edits `db_host`, `db_port`, `db_name`, and `db_user`, and accepts a new `db_password` (blank keeps the current one); `db_port` must be 1..65535. When a credential field actually changes, the backend evicts the cached external engine (`evict_custom_engine`) so the next request reconnects with the new credentials.
- **Entities** — `orders` → `usd_pct_abc.opened_orders`, `history` → `usd_pct_abc.order_history`, `account` → `usd_pct_abc.account_history` (newest row by `ts`). Each entity declares `schema`, `table`, optional `filter`/`order_by`, and a `columns` map from our field to a foreign column or `{column, map}` value map.
- **Value maps** — `side` is a plain column spec (`side` ← `side`, no value map; the raw LONG/SHORT passes through); `order_status` maps `M`/`MP` → `open`, `C*` → `cancelled`, `E*` → `expired`, `R*` → `rejected`. `mark_price` ← `mark_price` on the `orders` entity (display only: it feeds the read-only EQ · Future ladder's `Mark` column and nothing else; both foreign tables carry the column, but `history` does not map it); `current_price` is not mapped from the foreign schema — the backend resolves it per order ticker from the local `investment_main.whitelist_assets.price`, preferring the portfolio's `broker_id` row and otherwise the lowest `broker_id`, and a `NULL` price is missing (the order falls back to its entry price, so its Net P&L is 0; the foreign mark is never substituted), so Net P&L and the risk card's Sum P/L read that local asset price maintained in All Assets. `tp` is an exit-only price (falling back to `tp_price`, then `exit_price`) surfaced as the ladder's `Price out` for mapped orders and never read as P/L; `remark` carries the Mark note (`remark.note` is `Close` or `Canceled` on history rows). Money comes from the account row: `available_cash` ← `excessequity`, `margin_locked` ← `initialmargin`, `current_nav` ← `equity`; cash buffer and initial capital stay manual.
- **No DDL** — every path that opens a custom session checks `mapping_config` and skips `ensure_custom_tables()`, so `active_orders`/`transactions`/… are never created inside the foreign database.
- **Asset sync** — `POST /api/v1/assets/sync-from-orders` and `sync-from-all` collect tickers through one collector: main-DB `active_orders` plus every custom portfolio (legacy owned tables in their own session, mapped portfolios through the foreign-schema adapter, never `ensure_custom_tables` on a foreign database). Mapped tickers are inserted as `asset_type = 'future'` with `source = 'tfex'` and priced through the TFEX quote source; an unreachable custom database is skipped with a warning. All Assets data cells render at `var(--fs-label)` (11px), the same size as the order-detail numeric cells.
- **Read-only** — every data-plane write against a mapped portfolio — orders, assets, order groups, trade plans, trade history, ledger transactions — is refused by `raise_if_mapped_readonly` with `409 Portfolio is read-only (mapped external database)`. The analytics grid response carries `read_only: true` plus `mapping_template`, and the frontend hides every write affordance.

`mock/usd_pct_abc_dev_seed.sql` is the reference fixture for this mode: it creates `usd_pct_abc` with the three tables and loads 6 open orders, 4 history rows, and 3 account snapshots (dev only; idempotent).

---

## Notes

- `portfolios.available_cash` is auto-adjusted when Margin Locked/Cash Buffer Limit change
- `AssetGroup` seeds Ungrouped + Watchlist on first query via the `asset_groups` router
- `WhitelistAssets` extended to include price tracking columns; `source` distinguishes the live feeds (`yfinance`, `tfex`) from `manual`, and `price_symbol` holds the provider symbol (backfilled to `ticker` for existing rows)
- Yfinance prices fetched via direct HTTP (not yfinance library) to avoid rate limiting
- TFEX prices fetched from the public quotation series API; quotes are delayed (~15 min), the quotation page is warmed up once for its anti-bot cookies, one retry is attempted, and unknown/expired/blocked series are reported as fixed HTTP 502 messages
- Frontend caches last known price in `localStorage('cached_price_{ticker}')`
- `link_type` is NOT stored — computed server-side by `analytics.py._link_type()`
- Order status: `PENDING`, `FILLED` (non-terminal), `CLOSE`, `CANCELED` (terminal)
- Frontend Options Strategy state is per-portfolio in localStorage (6 `payoff_{key}_{pid}` keys)
- IV values for active orders are frontend-only (Controls panel, per-portfolio localStorage)
- Custom portfolio passwords are encrypted with Fernet using `FERNET_KEY` env var
- `is_custom` is migrated via `ALTER TABLE` in the FastAPI lifespan handler
- `custom_portfolio_connections` is created by `Base.metadata.create_all` on startup
- `custom_portfolio_connections.mapping_config` is added by `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in the FastAPI lifespan handler (existing rows stay `NULL`, i.e. owned-tables mode)

---

*Last updated: 23 November 2026 (`custom_portfolio_connections.mapping_config` + mapped read-only mode; dev fixture `mock/usd_pct_abc_dev_seed.sql`; `whitelist_assets.price_symbol` + yfinance/TFEX price sources)*
