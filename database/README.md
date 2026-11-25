# Investment Dashboard – Database Schemas

One PostgreSQL database powers the system, plus user-configured external PostgreSQL databases for Custom Portfolios.

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
- Managed Fund order creation does **not** register a main-database product/symbol; symbols belong to the broker-scoped asset registry and are added explicitly there
- target_ratio supports both decimal (0.4 = 40%) and percentage (40) input — auto-normalized to percentage on read
- Deleting a portfolio cascades to all `managed_fund_*` tables

---

## Main DB (`investment_main`) — `main_db_schema.sql`

Tables for portfolio management, managed fund, trade execution, ledger, the asset registry, and custom portfolio connections:

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
| `asset_products` | Broker-scoped product / contract spec: `product_id` PK, nullable `ticker` + `broker_id` FK + `asset_type`, `multiplier`, `margin_rate`, `source`, `margin_mode` (`notional`/`premium`/`span`), `group_id` FK→`asset_groups`, `name`, timestamps; natural key `UNIQUE NULLS NOT DISTINCT (ticker, broker_id, asset_type)` |
| `asset_symbols` | Contract symbol under a product: `symbol_id` PK, `product_id` FK→`asset_products` ON DELETE CASCADE, broker mirror, dashboard `price_symbol`, required provider `sync_symbol`, `contract_kind`, option terms, and multiplier/rate/span overrides |
| `asset_quotes` | Latest provider quote keyed by `(source, sync_symbol)`: nullable `price` and `change_24h`, required `updated_at`; no FK to symbols |
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
- `mapping_config` is nullable: `NULL` means the legacy mode (the backend creates and owns its tables in the external DB); a JSON object is a read-through mapping over an existing broker schema — see *Mapped read-through mode* below
- One record per custom portfolio (enforced by UNIQUE constraint)
- Used by the dynamic engine manager to create on-demand `AsyncEngine` instances

### Updated column on `portfolios`

- `is_custom BOOLEAN DEFAULT FALSE` — flags whether data routes to an external database

### Asset registry (`asset_products` / `asset_symbols` / `asset_quotes`)

`/assets/products` and `/assets/symbols` are the live main-database registry. The flat `whitelist_assets` table is not canonical and no longer exists in `investment_main` after startup. Root `/assets` only serves the custom (owned external DB) branch: a local non-custom call returns `404 Use /assets/products for the main asset registry`, a mapped `GET /assets?portfolio_id=` returns `[]`, and mapped writes stay `409 Portfolio is read-only (mapped external database)`. The removed `POST /assets/sync-from-orders` and `/assets/sync-from-all` return `404 Not Found`.

**Startup conversion and drop.** In the FastAPI lifespan, one transaction creates the three registry tables and the internal default product `(NULL,NULL,NULL)` (multiplier 1, rate 0, source `-`, mode `notional`, no symbols; never listed or editable). If `whitelist_assets` still exists, the migration first preflights duplicate normalized broker-scoped dashboard keys (a NULL broker is treated as the seeded `DF` broker), adds the legacy price/broker/multiplier columns, drops the old `whitelist_assets_ticker_key`, backfills `price_symbol = ticker` and NULL brokers to `DF`, converts each legacy row to exactly one product plus one symbol, upserts quotes by `(source, sync_symbol)`, translates matching `portfolios.product_tickers` contract symbols to the owning product ticker (unmatched values stay verbatim and order is preserved), asserts every conversion invariant, and only then runs `DROP TABLE whitelist_assets` — all in the same transaction. A failed preflight/assertion rolls back, so the legacy table survives and no registry rows commit. Boots where the table is already gone skip the legacy branch entirely; a second boot is a no-op. PostgreSQL uses an advisory transaction lock, `UNIQUE NULLS NOT DISTINCT`, and the partial/expression indexes; SQLite uses portable constraints and claims no PostgreSQL-only index enforcement.

**Product columns.** `product_id` PK; nullable `ticker`, `broker_id` FK→`brokers`, `asset_type`; `multiplier NUMERIC(20,8) NOT NULL DEFAULT 1`; `margin_rate NUMERIC(10,6) NOT NULL DEFAULT 0`; `source` (`yfinance`/`tfex`/`manual`/`-`); `margin_mode NOT NULL DEFAULT 'notional'` with `CHECK IN ('notional','premium','span')`; nullable `group_id` FK→`asset_groups`, `name`, timestamps. Natural key: `(ticker, broker_id, asset_type)`, with `UNIQUE NULLS NOT DISTINCT` on PostgreSQL so the all-NULL default identity cannot duplicate. API payload keys are exactly `product_id,ticker,broker_id,broker_code,asset_type,multiplier,margin_rate,margin_mode,source,group_id,name,symbol_count`; only `GET /assets/products/{product_id}` adds `symbols[]`.

**Symbol columns.** `symbol_id` PK; `product_id NOT NULL FK→asset_products ON DELETE CASCADE`; nullable broker mirror (application writes keep it equal to the product's broker; never exposed by the API); `price_symbol` = dashboard/order key; `sync_symbol VARCHAR NOT NULL` = case-preserving provider key used to fetch/store the quote; `contract_kind DEFAULT 'future'`; nullable `option_type`, `expiry_date`, `strike_price`, `multiplier_override`, `margin_rate_override`, `margin_per_contract`; timestamps. Dashboard keys must be unique per product and per broker, compared as `upper(trim(price_symbol))` only where non-NULL — the three PostgreSQL indexes are `(product_id, upper(trim(price_symbol))) WHERE price_symbol IS NOT NULL`, `(broker_id, upper(trim(price_symbol))) WHERE price_symbol IS NOT NULL`, and `(product_id, expiry_date, strike_price, option_type) WHERE contract_kind = 'option' AND price_symbol IS NULL`. Payload keys are exactly `symbol_id,product_id,price_symbol,sync_symbol,contract_kind,option_type,expiry_date,strike_price,multiplier_override,margin_rate_override,margin_per_contract,price,change_24h,updated_at`.

**Quote columns.** `(source, sync_symbol)` composite PK; nullable `price`, `change_24h`; required `updated_at`. Quote source is the product's `source` with blank/null normalized to `-`. Deleting a symbol or product deletes a quote only when no remaining symbol references that `(source, sync_symbol)`.

**Product/symbol API errors** (exact `detail`): blank product ticker or post-update all-NULL identity `400 Ticker is required`; duplicate product identity, rename collision, or `IntegrityError` `400 An asset with this ticker already exists`; invalid multiplier/rate/mode `400 multiplier must be greater than 0` / `400 margin_rate must be between 0 and 1` / `400 margin_mode must be one of notional, premium, span`; default product mutation `400 The default product is not editable`; broker change with attached symbols `400 Cannot change broker_id for product {ticker} (product_id={id}) while {n} symbols are attached`; unknown ids `404 Product not found` / `404 Symbol not found`; blank sync key `400 sync_symbol is required`; duplicate symbol `400 Symbol already exists`; normalized dashboard collision `400 Symbol {symbol} on broker {code} already belongs to product {ticker} (product_id={id})` (default owner: `400 Symbol {symbol} already exists on the default product`); option identity `400 Option identity already exists` or `400 Option contract already exists on product {ticker} (product_id={id})`.

**Proposal/apply.** `GET /assets/proposal` is read-only and lists distinct normalized order symbols from main, owned-custom, and mapped active orders (Managed Fund holdings/history are never sources), grouped by `(broker_id, symbol)`, each with same-broker product choices and a create default (`create: {ticker}` only); `order_asset_types` aggregates per `(broker_id, symbol)` across all portfolios of that broker and is a hint, not a default. Each item also carries `resolved`, true when a symbol in that broker scope already owns the normalized `price_symbol` (the same normalization as the pair key; brokerless pairs compare against products with `broker_id IS NULL`); it is informational and never removes the row from the proposal. A brokerless Active Trading portfolio is flagged `broker_required`. `POST /assets/apply` accepts one choice per proposed pair and performs nothing until called. Each choice must contain exactly one of `product_id` or `create_product=true`, else `400 Provide exactly one of product_id or create_product=true`; a pair not in the proposal is `400 Symbol {symbol} was not in the proposal`; a brokerless required pair is `400 Assign a broker in Edit portfolio before adding orders`; a cross-broker product is `400 Product {ticker} (product_id={id}) is not in broker {code}`; a duplicate create ticker is `400 A product with this ticker already exists`; a symbol owned by a different product uses the normalized collision detail above. A create choice also requires `create_source` (`yfinance`/`tfex`/`manual`), `create_asset_type` (`stock`/`future`/`option`/`crypto`), and `create_sync_symbol`; missing or invalid values are `400 Create needs a price source: yfinance, tfex or manual`, `400 Create needs an asset type: stock, future, option or crypto`, and `400 Create needs the provider symbol (sync_symbol)`. An existing `product_id` choice takes the new symbol's `contract_kind` from the product's asset type (`stock`/`future`/`crypto`), and an option product (`400 Add the option contract in All-assets — a sync row has no expiry, strike or type`) or a product without an asset type (`400 Set the asset type of product {ticker} in All-assets before syncing`) is refused before any write so it can be completed in All Assets. `manual` may omit the key and then stores the dashboard symbol. Applying the same owner is idempotent (no second symbol), and a provider fetch failure keeps existing/null quote values. The response is `{created, choices}`.

**Rename.** `PUT /assets/products/{product_id}` with a new `ticker` trims/uppercases it, prechecks the product identity and the broker-scoped normalized symbol collision (both conflicts are `400 An asset with this ticker already exists`), then in one transaction renames the product and rewrites that product's own `asset_symbols.price_symbol` rows whose normalized value matched the old ticker. `sync_symbol` and quote keys are never rewritten. Scalar cascades keep their historical case-sensitive comparison (`column == old_ticker`) for `active_orders.asset_type`, `trade_history.asset`, `transactions.asset`, `managed_fund_holdings.asset`, `managed_fund_orders.asset`, `managed_fund_order_history.asset`, and `portfolios.product_ticker`; `portfolios.product_tickers` uses normalized matching and preserves list order. Those ledger columns have no `broker_id`, so the scalar cascade is global across brokers. Mapped (foreign-schema) orders keep their own symbol.

**Margin.** Only a local `Active Trading` portfolio recomputes `margin_locked` from the registry. For every order it resolves the normalized broker-scoped symbol to its product, then applies exactly one product-mode formula: `notional` = mark × effective multiplier × qty × effective margin rate; `premium` = mark × effective multiplier × qty; `span` = qty × `margin_per_contract` when set, otherwise the premium value. The effective multiplier/rate is the symbol override when present, else the product value. Options are included; a missing broker, contract spec, mark, or qty contributes zero; the stored order `margin_rate` is ignored. Every other portfolio type (and `db=None`) returns the stored `margin_locked` unchanged, so registry edits never move their overview sums and Managed Fund keeps its policy input.

**Order guard.** Creating a local, non-custom, non-mapped `Active Trading` order requires a broker-scoped contract spec for its symbol: a NULL broker is `400 Assign a broker in Edit portfolio before adding orders`, and a missing normalized symbol is `400 No contract spec for {SYMBOL} on broker {CODE} — add it in All-assets first`. On update the guard runs only when `asset_type` changes, resolving the portfolio from the loaded order's own `portfolio_id` (never the optional query parameter). Custom, mapped, Managed Fund, Spread Strategy, and other portfolio types bypass it; mapped writes keep their read-only behavior.

### Price sources and refresh

- `POST /api/v1/assets/symbols/{symbol_id}/update-price` and `POST /api/v1/assets/symbols/batch-update-prices` fetch the quote using the symbol's `sync_symbol` and store it on `asset_quotes` keyed by `(product.source, sync_symbol)`. Manual quote: `PUT /api/v1/assets/symbols/{symbol_id}/quote` inserts or updates `price`/`change_24h`.
- `source = 'yfinance'` fetches from Yahoo Finance (direct HTTP, no `yfinance` library); `source = 'tfex'` fetches from the TFEX quotation API. `source = 'manual'` and `-` are never fetched; batch refresh skips them and reports `{updated, tickers}` with sorted unique successfully refreshed `price_symbol` values.
- **TFEX quotes are delayed** — the public quotation series endpoint (`/api/set/tfex/series/{symbol}/info`) returns the last traded price, not a live tick, so values lag the exchange by roughly 15 minutes. The client warms up the quotation page once for its anti-bot cookies and retries once before reporting failure. `sync_symbol` accepts the series code or the TFEX product-page URL, and a halted or illiquid series with no last trade falls back to the bid/offer mid, settlement price, or prior settlement price.
- A TFEX fetch failure is returned as HTTP 502 with a fixed message: unknown/expired series symbol, no usable quote, or a blocked request. Batch refresh skips individual failures; automatic `POST /assets/apply` provider fetches are best effort and retain existing/null quotes.

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
- Default groups cannot be edited or deleted (enforced by backend)
- Frontend renders groups as collapsible, droppable section rows inside one registry table whose product rows expand to symbol/quote sub-rows

### Key columns on `active_orders`

- `order_id TEXT PRIMARY KEY` — UUID string
- `linked_order_id TEXT` — one-way link or cross-link
- `group_id INTEGER FK → orders_groups(id)`
- `contract_type TEXT` — `'spot'`, `'future'`, or `'option'`; a mapped portfolio's dashboard-local option rows are ordinary main rows on this table, selected by normalized `contract_type == 'option'` (no extra table or source column)
- `option_type TEXT` — `'Call'` or `'Put'`
- `side TEXT` — `'BUY'`/`'SELL'` (spot), `'LONG'`/`'SHORT'` (futures/options)
- `expiry_date TIMESTAMP`, `strike_price NUMERIC(20,8)`, `cost NUMERIC(20,8)`

## Custom Portfolio – External DB (Data Plane)

When a portfolio has `is_custom = True`, its transactional data is stored on a **separate PostgreSQL database** managed by the user. In the default (owned-tables) mode these tables are FK-free copies of the main DB tables:

| Table | Purpose |
|-------|---------|
| `active_orders` | Same columns as main, but `portfolio_id` is plain Integer (no FK) |
| `transactions` | Same columns as main, but `source_portfolio_id`/`destination_portfolio_id` are plain Integer |
| `trade_plans` | Same columns as main, `plan_id` is plain Integer (no FK) — added to avoid `ForeignKeyViolationError` on order creation referencing main-DB plan IDs |
| `whitelist_assets` | Legacy owned-custom layout only (flat asset rows, `group_id` plain Integer, no FK). It is not the main registry and is untouched by the startup conversion; new main-registry products/symbols live only in `investment_main` |
| `asset_groups` | Same columns as main |
| `orders_groups` | Same columns as main, `portfolio_id` is plain Integer |

Tables are created **lazily** — only on the first API request for that portfolio. Schema sync is isolated per database (no `metadata.create_all()` globals).

On first access, `ensure_custom_tables()` runs an auto-migration: it queries `information_schema.columns` for each table and runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for any columns missing from the external DB. It also **drops all existing FK constraints** via `ALTER TABLE ... DROP CONSTRAINT` to ensure the tables are FK-free (main-DB IDs like `plan_id`, `portfolio_id`, `group_id` don't exist in external DBs).

### Mapped read-through mode (`mapping_config`)

A non-null `custom_portfolio_connections.mapping_config` switches the same portfolio to a **read-through view** over a schema that already exists (a broker's database). The JSON is the contract; nothing about the foreign schema is assumed beyond what it declares.

- **Template** — `tfex-settrade-v1` (`TFEX / Settrade`), exposed by `GET /api/v1/portfolios/mapping-templates`. Select it on create or PATCH it onto an existing connection (`PATCH /api/v1/portfolios/{id}/connection`); a stored config is a snapshot and does not follow later template edits.
- **Connection editing** — the same `PATCH` edits `db_host`, `db_port`, `db_name`, and `db_user`, and accepts a new `db_password` (blank keeps the current one); `db_port` must be 1..65535. When a credential field actually changes, the backend evicts the cached external engine (`evict_custom_engine`) so the next request reconnects with the new credentials.
- **Entities** — `orders` → `usd_pct_abc.opened_orders`, `history` → `usd_pct_abc.order_history`, `account` → `usd_pct_abc.account_history` (newest row by `ts`). Each entity declares `schema`, `table`, optional `filter`/`order_by`, and a `columns` map from our field to a foreign column or `{column, map}` value map.
- **Value maps** — `side` is a plain column spec (`side` ← `side`, no value map; the raw LONG/SHORT passes through); `order_status` maps `M`/`MP` → `open`, `C*` → `cancelled`, `E*` → `expired`, `R*` → `rejected`. `mark_price` ← `mark_price` on the `orders` entity (display only: it feeds the read-only EQ · Future ladder's `Mark` column and nothing else; both foreign tables carry the column, but `history` does not map it); `current_price` is not mapped from the foreign schema — the backend resolves it per order ticker from the local registry: `asset_symbols.price_symbol` (matched with `upper(trim(...))` in the portfolio's broker scope) joined to `asset_quotes.price`, preferring the portfolio's `broker_id` and otherwise the lowest `broker_id`, and a `NULL` price is missing (the order falls back to its entry price, so its Net P&L is 0; the foreign mark is never substituted), so Net P&L and the risk block's Sum P/L (`risk.pl_total`) read that local asset price maintained in All Assets. `tp` is an exit-only price (falling back to `tp_price`, then `exit_price`) surfaced as the ladder's `Price out` for mapped orders and never read as P/L; `remark` carries the Mark note (`remark.note` is `Close` or `Canceled` on history rows). Money comes from the account row: `available_cash` ← `excessequity`, `margin_locked` ← `initialmargin`, `current_nav` ← `equity`; cash buffer and initial capital stay manual.
- **No DDL** — every path that opens a custom session checks `mapping_config` and skips `ensure_custom_tables()`, so `active_orders`/`transactions`/… are never created inside the foreign database.
- **No auto-sync** — the order-derived `sync-from-orders`/`sync-from-all` writers are removed and their routes return `404`. `GET /api/v1/assets/proposal` only reads distinct normalized active-order symbols across main, owned-custom, and mapped portfolios (never creating anything and never reading Managed Fund holdings/history); `POST /api/v1/assets/apply` writes only the product/symbol choices the user explicitly submits. An unreachable custom database is skipped while building the proposal. All Assets data cells render at `var(--fs-label)` (11px), the same size as the order-detail numeric cells.
- **Read-only foreign rows** — every data-plane write against the connected rows of a mapped portfolio — foreign orders, assets, order groups, trade plans, foreign trade history, ledger transactions — is refused by `raise_if_mapped_readonly` with `409 Portfolio is read-only (mapped external database)`. The one hybrid exception is a dashboard-local option row: a mapped `POST /orders` whose normalized `contract_type` is `option` writes main `active_orders` + the default main `trade_plan` (broker + broker-scoped `price_symbol` spec required), and its edit/close/cancel writes main `trade_history`; non-option creates keep the foreign writer. Source-routed single-row routes require `?order_source=dashboard|mapped` (missing/unknown → `400 Order source is required for a mapped portfolio: dashboard or mapped`, absent row → `404`, no fallback), and responses carry `order_source` / `history_source` + `history_key` as API metadata only. The analytics grid response carries `read_only: true` plus `mapping_template` and the store-scoped `order_writes: {mapped: {insert, update, delete, fields, key_generated} | null, dashboard_options: {insert, update, delete}}`; the frontend gates mapped affordances on `order_writes.mapped` and option affordances on `order_writes.dashboard_options`. No new table, column or migration exists for the hybrid path: local option rows reuse the main `active_orders`/`trade_history` shape, and `order_source`/`history_source`/`history_key` are derived at read time. When the connected read fails, analytics keeps dashboard-local option rows/history and `load_error`, reports `mapped: null`, and keeps `dashboard_options` true.

`mock/usd_pct_abc_dev_seed.sql` is the reference fixture for this mode: it creates `usd_pct_abc` with the three tables and loads 6 open orders, 4 history rows, and 3 account snapshots (dev only; idempotent).

---

## Notes

- `portfolios.available_cash` is auto-adjusted when Margin Locked/Cash Buffer Limit change
- `AssetGroup` seeds Ungrouped + Watchlist on first query via the `asset_groups` router
- The live main registry is `asset_products` + `asset_symbols` + `asset_quotes`; `whitelist_assets` was converted and dropped by the startup migration. `price_symbol` is the dashboard/order key, `sync_symbol` the provider fetch key, and `source` (`yfinance`/`tfex`/`manual`/`-`) selects the feed
- Managed Fund order creation never inserts into the main registry; local prices come from `asset_quotes` via normalized `asset_symbols.price_symbol`
- Yfinance prices fetched via direct HTTP (not yfinance library) to avoid rate limiting
- TFEX prices fetched from the public quotation series API; quotes are delayed (~15 min), the quotation page is warmed up once for its anti-bot cookies, one retry is attempted, and unknown/expired/blocked series are reported as fixed HTTP 502 messages
- Frontend caches last known price in `localStorage('cached_price_{price_symbol}')` (and under the sync symbol when the two differ)
- `link_type` is NOT stored — computed server-side by `analytics.py._link_type()`
- Order status: `PENDING`, `FILLED` (non-terminal), `CLOSE`, `CANCELED` (terminal)
- Frontend Options Strategy state is per-portfolio in localStorage (6 `payoff_{key}_{pid}` keys)
- IV values for active orders are frontend-only (Controls panel, per-portfolio localStorage)
- Custom portfolio passwords are encrypted with Fernet using `FERNET_KEY` env var
- `is_custom` is migrated via `ALTER TABLE` in the FastAPI lifespan handler
- `custom_portfolio_connections` is created by `Base.metadata.create_all` on startup
- `custom_portfolio_connections.mapping_config` is added by `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in the FastAPI lifespan handler (existing rows stay `NULL`, i.e. owned-tables mode)

---

*Last updated: 25 November 2026 (hybrid mapped-portfolio options: dashboard-local option orders/history in main PostgreSQL, source-routed active/history reads with `order_source`/`history_source`/`history_key`, store-scoped `order_writes`, union margin/performance and degraded local rows; broker-scoped `asset_products`/`asset_symbols`/`asset_quotes` registry replacing the main `whitelist_assets` table; one-time startup conversion + drop; product/symbol/proposal API contracts; margin modes and the Active Trading order guard; price_symbol vs sync_symbol; mapped read-through mode retained)*
