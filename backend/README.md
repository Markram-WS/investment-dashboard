# Investment Dashboard – Backend

A FastAPI-powered backend for professional investment management, including portfolio tracking, trade plans, active orders, a broker-scoped product/symbol asset registry with Yahoo Finance and TFEX quotes, and **dynamic multi-database custom portfolios**.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start – Local Cluster](#quick-start--local-cluster)
4. [Environment Variables](#environment-variables)
5. [API Reference](#api-reference)
6. [Project Structure](#project-structure)
7. [Custom Portfolio – Multi-Database Architecture](#custom-portfolio--multi-database-architecture)
8. [Hands-On Tests](#hands-on-tests)
9. [Advanced Usage](#advanced-usage)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This backend is built with:

- **FastAPI** – modern, async REST API
- **SQLAlchemy 2.0 (async)** – ORM & DB engine
- **PostgreSQL** – one core database (`investment_main`) plus user-configured external databases for Custom Portfolios
- **Podman + kind** – image builds and the local Kubernetes dev cluster

**Key additions:**

- **Managed Fund** (`port_type = "Managed Fund"`) — portfolio rebalancing with separate order flow: holdings, orders (pending→done→history), NAV tracking, underlying-group neutral allocation, and profit threshold alerts. Order creation never registers a product/symbol; local prices read the broker-scoped registry
- **Custom Portfolio type** replaces `Spread Strategy` — portfolios with isolated external PostgreSQL databases
- **`CustomPortfolioConnection` model** — stores encrypted credentials (Fernet) for external DB connections
- **`POST /api/v1/portfolios/test-connection`** — validates external DB connectivity at form time
- **Dynamic engine manager** — caches `AsyncEngine` instances per portfolio_id; lazy-connects only on first request
- **`CustomTradePlan` model** — FK-free replica of `TradePlan` for custom DBs, resolves FK constraint errors when creating orders against custom portfolio trade plans
- **`ensure_custom_tables` auto-migration** — compares model columns vs `information_schema.columns`; runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for missing columns; drops all FK constraints to match FK-free model design
- **Asset registry** — `asset_products` (broker-scoped contract specs, `margin_mode` = `notional`/`premium`/`span`), `asset_symbols` (`price_symbol` = dashboard/order key, required `sync_symbol` = provider key), and `asset_quotes` (keyed by `(source, sync_symbol)`). A transactional startup migration converts any legacy `whitelist_assets` rows and then drops that table; `Base.metadata.create_all` excludes both the legacy and registry tables
- **Targeted schema sync** — owned custom DBs receive FK-free replicas of `active_orders`, `transactions`, `trade_plans`, `whitelist_assets`, `asset_groups`, `orders_groups` on first access. That custom `whitelist_assets` is an external per-portfolio table, not the main registry
- **Two price sources** — the product's `source` selects the feed: `yfinance` (Yahoo Finance, direct HTTP) or `tfex` (TFEX public quotation API, delayed quotes). `sync_symbol` is the case-preserving provider key used for the fetch; `price_symbol` is the dashboard/order key orders match, so they can differ (`PTT` vs `PTT.BK`). `update-price` and `batch-update-prices` resolve the quote through `sync_symbol`
- **`resolve_portfolio_db(db, portfolio_id)`** — per-request session routing helper; replaces `get_custom_session_maker`
- **All order endpoints refactored** — `POST`, `PUT`, `PATCH status`, `close`, `link`, `unlink` accept `?portfolio_id=` query param and route to correct DB
- **All CRUD endpoints refactored** — `assets.py`, `asset_groups.py`, `orders_groups.py` POST/PUT/DELETE accept `?portfolio_id=` for custom portfolio support
- **`group_name` resolution for custom orders** — analytics endpoints query `CustomOrdersGroup` table to populate `order.group_name` (since custom models have no ORM relationship)
- **`GET /api/v1/transactions` global query** — aggregates transactions from `investment_main` + all custom DBs concurrently via `asyncio.gather(return_exceptions=True)`; includes `partial_data` and `failed_portfolios` warning flags when external nodes fail

---

## Prerequisites

- Podman (rootless) with `kind` and `kubectl` for the local Kubernetes dev cluster
- (Optional) Python 3.11+ if running locally without containers

---

## Quick Start – Local Cluster

The backend runs as a Kubernetes Deployment in the local kind cluster created by `scripts/kind-up.sh` from the repository root.

```bash
# 1. From the repository root: create secrets and start the cluster
cp deploy/base/secrets.env.example deploy/base/secrets.env   # then fill in real values
./scripts/kind-up.sh

# 2. Forward the backend Service to the host
kubectl -n investment-dashboard port-forward svc/backend 8000:8000

# 3. Verify the API is running
curl http://localhost:8000/health
# → {"status":"healthy"}

# 4. Open Swagger UI
open http://localhost:8000/docs
```

> Tables are auto-created on first startup via the FastAPI `lifespan` handler. The asset-registry migration also runs there in one transaction: it creates `asset_products`/`asset_symbols`/`asset_quotes` and the internal default product, converts any `whitelist_assets` rows, asserts the conversion, and drops the legacy table. A database that no longer has `whitelist_assets` skips the legacy branch; repeated starts are no-ops.
> Custom DB connections are **never** initialized during startup — they are established lazily on first per-portfolio API request.
> `order_id` in `active_orders` is a **UUID string** (not auto-increment integer).
> `portfolios.internal_notes` stores free-text observations; editable via `PUT /api/v1/portfolios/{id}`.
> `portfolios.tags` is a JSONB map of key→bool for metadata filtering.
> `risk_score` (0–100) is computed server-side from `available_cash`, `margin_locked`, `cash_buffer_limit`.
> Order status values are uppercase: `PENDING`, `FILLED`, `CLOSE`, `CANCELED`.
> The backend, frontend and the PostgreSQL instance run in the `investment-dashboard` namespace as Deployments/StatefulSets. Logs: `kubectl -n investment-dashboard logs -f deploy/backend`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://dashboard:dashboard@localhost:5432/investment_main` | Main DB connection (the kind overlay sets it to the `postgres-main` Service) |
| `PORT` | `8000` | HTTP port exposed by the container |
| `FERNET_KEY` | *(required for Custom Portfolio)* | Symmetric key for encrypting DB passwords. Generate: `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'` |

---

## API Reference

Collection endpoints are registered **without a trailing slash** (e.g. `/api/v1/portfolios`, `/api/v1/orders`, `/api/v1/trade-plans`). The slashed form still works: Starlette's `redirect_slashes` answers it with a `307 Temporary Redirect` to the canonical path.

### Portfolios
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/portfolios` | List all portfolios |
| `POST` | `/api/v1/portfolios` | Create a new portfolio (supports connection fields for Custom Portfolio; `mapping_config` JSON switches it to read-only read-through; target_ratio auto-normalized from decimal→percentage) |
| `GET` | `/api/v1/portfolios/types` | List available portfolio types (Managed Fund, Active Trading, Custom Portfolio) |
| `GET` | `/api/v1/portfolios/mapping-templates` | Built-in mapping templates (`tfex-settrade-v1`); the returned `config` is exactly what `mapping_config` stores |
| `GET` | `/api/v1/portfolios/{id}` | Retrieve portfolio by ID (includes connection metadata for custom) |
| `PUT` | `/api/v1/portfolios/{id}` | Update portfolio fields (a Managed Fund always stores `product_type = mutual_fund` and may carry `broker_id`) |
| `GET` | `/api/v1/portfolios/{id}/connection` | Custom connection metadata — host, port, db_name, user, `mapping_config`; the password is never returned |
| `PATCH` | `/api/v1/portfolios/{id}/connection` | Edit `db_host`/`db_port`/`db_name`/`db_user` and optionally `db_password` (blank keeps the current one), plus `mapping_config` (validated; `null` returns to owned-tables mode). `db_port` must be 1–65535; a real credential change evicts the cached engine |
| `DELETE` | `/api/v1/portfolios/{id}` | Delete portfolio with cascade (also cleans managed_fund_* tables) |
| `POST` | `/api/v1/portfolios/test-connection` | Test external DB connectivity (host, port, db_name, user, password); optional `mapping_config` adds `diagnostics` |
| `POST` | `/api/v1/portfolios/{id}/test-connection` | Test the **stored** connection with the saved password (must be declared after the literal route); optional `mapping_config` override — omitted uses the stored mapping, explicit `null` means connect-only — returns `diagnostics` |

**Portfolio product identity.** `portfolios.product_type` (`stock` / `future` / `option` / `crypto` / `mutual_fund`, nullable) is the type half of the portfolio's display identity; `product_ticker` / `product_tickers` stay the underlying selection. `GET /portfolios` (adds `product_type` only), `GET /portfolios/{id}`, `POST`, `PUT` and the analytics/risk grids (`PortfolioGridData`: `/analytics/portfolio-grid`, the single-portfolio grid and the mapped fallbacks) return `product_type: string | null`. `POST` and `PUT` accept it; values are trimmed/lowercased and anything outside the list is `400 product_type must be one of stock, future, option, crypto or mutual_fund`, while `null` clears it without touching the tickers. A Managed Fund (`port_type = "Managed Fund"`) is the exception: it always stores `mutual_fund` on create and update (a client value is accepted but never overrides it) and may carry `broker_id`. The display multiplier/margin resolve `(first product_tickers entry, broker_id, product_type)`; with `product_type: null` the legacy unique ticker + broker match is used, so a ticker shared by several types resolves to nothing and displays multiplier 1 / margin rate 0. This is display-only: per-order margin still resolves each order's own broker-scoped symbol spec and a missing spec contributes zero, so the portfolio type never moves `margin_locked`.

### Managed Fund
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/managed-funds/{portfolio_id}/settings` | Get MF settings (`target_ratio` kept for compatibility, `allocation_mode`, profit thresholds); auto-creates row if missing, backfills target_ratio from Portfolio table |
| `PUT` | `/api/v1/managed-funds/{portfolio_id}/settings` | Update MF settings (`target_ratio`, `allocation_mode`, `global_profit_threshold`); `allocation_mode` accepts only `neutral` (`400 Unsupported allocation mode` otherwise) |
| `GET` | `/api/v1/managed-funds/{portfolio_id}/holdings` | List asset holdings; each row adds `broker_id`, `broker_code` and `underlying` derived by joining its `asset` to the registry (`UPPER(TRIM(price_symbol))` → `asset_products` → `brokers`; the portfolio broker is only the preferred row, else lowest broker then lowest symbol id) — all three `null` when unregistered. Create/update return the same fields |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/holdings` | Create a holding (manual); Current starts at the registry quote (portfolio broker preferred) when one exists, else the submitted entry price |
| `PUT` | `/api/v1/managed-funds/{portfolio_id}/holdings/{holding_id}` | Update holding (profit_threshold) |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/holdings/{holding_id}/sell` | Create a Sell order from a holding |
| `GET` | `/api/v1/managed-funds/{portfolio_id}/orders` | List orders in progress |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/orders` | Create a new order (does not register a product/symbol in the main registry) |
| `PUT` | `/api/v1/managed-funds/{portfolio_id}/orders/{order_id}` | Update order fields |
| `PATCH` | `/api/v1/managed-funds/{portfolio_id}/orders/{order_id}/status` | Confirm (→done) or Cancel order; on done: updates holdings, adjusts available_cash, records NAV history, moves to history table; a newly created holding takes its Current from the registry quote (portfolio broker preferred), falling back to the order price |
| `GET` | `/api/v1/managed-funds/{portfolio_id}/history` | List order history |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/rebalance/calculate` | Neutral rebalance: group holdings by registry underlying (broker ignored, unregistered → `Unassigned`), measure each group's share against NAV (`current_nav`; falls back to holdings market value + available cash when NAV is missing), target `100/N %` of NAV per group, split each group's drift value across its holdings by current market-value proportion. Returns group-keyed `target_allocations`/`current_allocations`, symbol-level recommendations with `underlying`, and `total_drift`; empty/zero-value funds return empty recommendations (never `400`) |
| `GET` | `/api/v1/managed-funds/{portfolio_id}/alerts` | Profit threshold alerts; each holding fires at `max(holding.profit_threshold, global_profit_threshold / N)` where `N` is the number of underlying groups |
| `POST` | `/api/v1/managed-funds/{portfolio_id}/sync-prices` | Refresh each holding's price from the asset registry: resolve the holding's normalized asset to the `asset_symbols` row that prices it (portfolio broker first, else lowest broker, then lowest symbol id), fetch the provider quote once per `(source, sync_symbol)` for `yfinance`/`tfex` (manual rows are never fetched), then recompute price, market value and P/L. Returns `synced`/`total`/`missing`/`failed`; a provider failure keeps the stored quote and lists the symbol in `failed` without aborting the request. The same repricing runs automatically after a quote write in All Assets (`PUT /assets/symbols/{id}/quote`, `POST /assets/symbols/{id}/update-price`, `POST /assets/symbols/batch-update-prices`) |

### Active Orders
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `POST` | `/api/v1/orders` | Place a new order; for a mapped portfolio, an order whose normalized `contract_type` is `option` writes dashboard `active_orders` (after the broker + broker-scoped option-spec guard), while every other contract type inserts a foreign `opened_orders` row when the config declares `write.insert`. The response carries `order_source: dashboard|mapped` and `underlying` (the resolved product ticker, `""` for a mapped row) |
| `GET` | `/api/v1/orders` | List orders (optional `?portfolio_id=`); a mapped portfolio returns the union of normalised foreign rows and dashboard rows whose normalized `contract_type` is `option`, each tagged `order_source`, sorted `created_at` desc (nulls last) → dashboard before mapped → `order_id` asc. Every row carries `underlying`: the product ticker that owns the order symbol's broker-scoped contract spec (one batched registry lookup per request); `""` when unassigned — always for mapped rows, unknown symbols and brokerless portfolios |
| `GET` | `/api/v1/orders/{order_id}` | Get order details. On a mapped portfolio `?order_source=dashboard|mapped` is required (missing/unknown → `400 Order source is required for a mapped portfolio: dashboard or mapped`); only the named store is queried, an absent row is `404`, and there is no fallback |
| `PUT` | `/api/v1/orders/{order_id}` | Update order fields. A mapped portfolio requires the same `order_source`; mapped update touches only `write.columns` (unwritable field → 400), dashboard update targets only its local option row and repeats the broker/spec guard when `asset_type` changes |
| `PATCH` | `/api/v1/orders/{order_id}/status` | Change order status. A mapped portfolio requires `order_source`; a dashboard option cancel deletes the local row and writes main `trade_history` in one transaction, while a mapped cancel keeps the foreign history insert + open-row delete |
| `POST` | `/api/v1/orders/{order_id}/close` | Close order with exit price/P&L. A mapped portfolio requires `order_source`; dashboard close writes main `trade_history` only, mapped close inserts the foreign `order_history` row and deletes the open row in one transaction |
| `POST` | `/api/v1/orders/{order_id}/link` | Link order to a target order |
| `POST` | `/api/v1/orders/{order_id}/unlink` | Unlink order |

### Overview
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/overview` | Global dashboard overview (supports `?portfolio_id=`) |

### Analytics
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/analytics/portfolio-grid` | Full grid data (supports `?portfolio_id=`); mapped rows carry `active_orders[]` with `order_source`, `recent_trades[]` with `history_source`/`history_key`, and the store-scoped `order_writes` |
| `GET` | `/api/v1/analytics/portfolio/{portfolio_id}` | Single portfolio detail. A mapped portfolio merges dashboard-local option orders and connected rows for orders, recent trades, risk and margin: `margin_locked` = foreign account margin + dashboard option margin from broker-scoped specs; `order_writes` is `{mapped: <capabilities|null>, dashboard_options: {insert,update,delete}}`; a foreign failure still serves local rows plus `load_error` |
| `GET` | `/api/v1/analytics/performance/{portfolio_id}` | Performance data. A mapped portfolio aggregates realized P/L from dashboard `trade_history` + connected mapped history; a foreign failure falls back to dashboard rows only |

### Transactions
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/transactions` | List transactions (supports `?portfolio_id=`; global query aggregates all custom DBs) |
| `POST` | `/api/v1/transactions` | Create transaction (supports `?portfolio_id=` to write to custom DB) |
| `GET` | `/api/v1/transactions/{id}` | Get transaction by ID (supports `?portfolio_id=`) |

### Transfers
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/transfers` | List transfers |
| `POST` | `/api/v1/transfers` | Create a transfer |
| `POST` | `/api/v1/transfers/{id}/confirm` | Confirm a pending transfer |

### Assets — broker-scoped registry

The main registry is two levels: a **product** (the identity `underlying + broker + type`) owns **symbols** (dashboard price/order keys) and each symbol joins its latest **quote**. The product owns multiplier, margin rate, margin mode, span margin, source and the effective contract type; a symbol owns only its price/provider keys and option terms. Root `/api/v1/assets` is no longer a main-database CRUD surface:

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/assets` | Custom (owned external-DB) branch only: flat asset list, optional `?asset_type=`/`?source=`/`?group_id=`/`?portfolio_id=`. A mapped portfolio returns `[]`; a local non-custom request returns `404 Use /assets/products for the main asset registry` |
| `POST`/`PUT`/`DELETE` | `/api/v1/assets[/{asset_id}]` | Custom owned-DB CRUD only (flat shape preserved). Local non-custom is `404 Use /assets/products for the main asset registry`; mapped writes are `409 Portfolio is read-only (mapped external database)` |
| `POST` | `/api/v1/assets/sync-from-orders` | **Removed — `404 Not Found`** |
| `POST` | `/api/v1/assets/sync-from-all` | **Removed — `404 Not Found`** |

**Products**

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/assets/products` | List non-default products; filters `group_id`, `asset_type`, `source`, `broker_id`; ordered by `upper(ticker)`, `broker_id`, `asset_type` (NULLs last). Keys exactly `product_id,ticker,broker_id,broker_code,asset_type,multiplier,margin_rate,margin_mode,margin_per_contract,source,group_id,name,symbol_count` (`margin_per_contract` is a float or `null`) |
| `POST` | `/api/v1/assets/products` | Create a product from `ticker,broker_id,asset_type,multiplier,margin_rate,margin_mode,margin_per_contract,source,group_id,name`. `ticker` is trimmed/uppercased; a blank ticker is stored as `NULL` (an unassigned underlying) whenever `broker_id` or `asset_type` is set, and only the all-NULL triple — the reserved default-product identity — is `400 Ticker is required`; duplicate identity is `400 An asset with this ticker already exists`. `margin_per_contract` is the identity-owned span value (nullable; `400 margin_per_contract must be zero or greater`) |
| `GET` | `/api/v1/assets/products/{product_id}` | Product detail — same keys plus `symbols[]`; unknown is `404 Product not found` |
| `PUT` | `/api/v1/assets/products/{product_id}` | Partial update. The default product is `400 The default product is not editable`; a blank ticker is accepted while the product keeps a broker or a type (`ticker: NULL`, unassigned) and is `400 Ticker is required` when it would leave the all-NULL default identity; a blank side never runs the rename cascade (order/ledger symbols are not nulled or claimed). Null/invalid values are `400 multiplier must be greater than 0`, `400 margin_rate must be between 0 and 1`, `400 margin_mode must be one of notional, premium, span`, `400 margin_per_contract must be zero or greater`; an explicit `null` `margin_per_contract` clears only the span value (every other field is left untouched); changing `broker_id` while symbols are attached is `400 Cannot change broker_id for product {ticker} (product_id={id}) while {n} symbols are attached` |
| `DELETE` | `/api/v1/assets/products/{product_id}` | Delete the product, its symbols, and unreferenced quotes (`204`) |

**Rename.** A product ticker rename prechecks the product identity and the broker-scoped normalized symbol collision; both conflicts return `400 An asset with this ticker already exists`. In one transaction it then (a) rewrites scalar references with the historical case-sensitive comparison — `active_orders.asset_type`, `trade_history.asset`, `transactions.asset`, `managed_fund_holdings.asset`, `managed_fund_orders.asset`, `managed_fund_order_history.asset`, `portfolios.product_ticker`; (b) rewrites entries of `portfolios.product_tickers` with normalized comparison, preserving order and unmatched values; and (c) rewrites **only this product's own** `asset_symbols.price_symbol` rows whose normalized value equals the old ticker. `sync_symbol` and quote keys are untouched. The scalar ledger columns carry no `broker_id`, so that part still moves every broker's matching ticker; mapped (foreign-schema) orders keep their own symbol and are never renamed.

**Symbols and quotes**

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/assets/symbols` | List symbols, optional `?product_id=`, joined to their current quote. Keys exactly `symbol_id,product_id,price_symbol,sync_symbol,contract_kind,option_type,expiry_date,strike_price,multiplier_override,margin_rate_override,multiplier_effective,margin_rate_effective,multiplier_inherited,margin_rate_inherited,margin_per_contract,price,change_24h,updated_at` (the broker mirror is never exposed). `*_effective` is the identity (underlying + broker + type) value the margin formula uses — the product value, or 1 for multiplier / 0 for margin rate when NULL; `*_inherited` is always `true` because a contract cannot override those two. `contract_kind` is also the identity's value (the product `asset_type`, or the legacy `future` fallback when the identity has no type) and `margin_per_contract` is the product's span value (float or `null`) — the symbol's own `contract_kind` / `margin_per_contract` columns are never read. `multiplier_override`/`margin_rate_override` stay in the payload for compatibility (legacy columns) and are always null for rows written through the API |
| `POST` | `/api/v1/assets/products/{product_id}/symbols` | Create a symbol; `sync_symbol` is required. Any identity may own symbols, the default identity included (its symbols carry no broker-scoped spec, so the Active Trading order guard blocks orders for them while mapped portfolios work). A non-null `multiplier_override`/`margin_rate_override`/`margin_per_contract` is `400 multiplier is set on the underlying + broker + type, not on the contract` / `400 margin_rate is set on the underlying + broker + type, not on the contract` / `400 margin per contract is set on the underlying + broker + type, not on the contract`. The stored `contract_kind` is always the owning product's `asset_type` (legacy `future` fallback when the identity has no type); a supplied `contract_kind` that differs from it is `400 contract type is set by the underlying + broker + type`. Blank sync key is `400 sync_symbol is required`; duplicates are `400 Symbol already exists`; normalized dashboard collisions return `400 Symbol {symbol} on broker {code} already belongs to product {ticker} (product_id={id})` (default product: `400 Symbol {symbol} already exists on the default product`); option identity conflicts are `400 Option identity already exists` / `400 Option contract already exists on product {ticker} (product_id={id})` |
| `PUT` | `/api/v1/assets/symbols/{symbol_id}` | Update symbol fields; the same multiplier/margin/span override rejections and the same `contract type is set by the underlying + broker + type` check as above, plus blank sync key, duplicate, collision and option-identity errors; `product_id` moves the contract to another product (collision and option-identity checks rerun, the broker mirror follows, `contract_kind` re-derives from the new owner; `null`/omitted = no move) and an unknown target is `404 Product not found`; unknown symbol is `404 Symbol not found` |
| `DELETE` | `/api/v1/assets/symbols/{symbol_id}` | Delete symbol; deletes its quote only when no other symbol references `(source, sync_symbol)` (`204`) |
| `PUT` | `/api/v1/assets/symbols/{symbol_id}/quote` | Set manual `price`/`change_24h`; inserts the quote row when absent |
| `POST` | `/api/v1/assets/symbols/{symbol_id}/update-price` | Fetch one quote from the product's `source` using `sync_symbol`; `manual`/`-` only refresh `updated_at`; provider failure is `502 Failed to fetch price: ...` |
| `POST` | `/api/v1/assets/symbols/batch-update-prices` | Refresh every distinct supported `(source, sync_symbol)` once; failures are skipped; returns `{updated, tickers}` where `tickers` is the sorted unique refreshed `price_symbol` set |

**Proposal / apply.** `GET /api/v1/assets/proposal` is read-only: it collects distinct normalized active-order symbols from main, owned-custom, and mapped portfolios (plus Managed Fund holdings and still-open fund orders merged into the same pair), sorts by `(broker_id, symbol)`, and returns same-broker product choices plus a create default (`create: {symbol}` only — the normalized order symbol, which is the contract key, never the underlying); `order_asset_types` aggregates per `(broker_id, symbol)` and is a hint, not a default. A fund row records no contract type, so a fund-only pair reports an empty `order_asset_types`; `done`/`cancelled` fund orders and fund history are not sources. Each item also carries `resolved`, true when a symbol in that broker scope already owns the normalized `price_symbol` (same normalization as the pair key; brokerless pairs compare against products with `broker_id IS NULL`) — informational only, the pair stays assignable. A brokerless Active Trading portfolio is flagged `broker_required` (informational; the UI lets the user pick a broker on the row). `POST /api/v1/assets/apply` writes only explicit choices, all in one transaction: exactly one of `product_id` or `create_product=true` (`400 Provide exactly one of product_id or create_product=true`), the pair must be in the recomputed proposal (`400 Symbol {symbol} was not in the proposal`), each choice may carry a `broker_id` (null = the proposal pair's broker) whose unknown value is `400 Broker {id} not found` and which drives every identity lookup and product check, and the product must belong to that chosen broker (`400 Product {ticker} (product_id={id}) is not in broker {code}`), and a duplicate create identity (underlying + broker + asset type) is `400 An asset with this ticker already exists`. A create choice writes a product whose `ticker` is the explicit `create_underlying` (trimmed/uppercased like any product ticker; blank stores `NULL`) and whose `asset_type` is the optional explicit `create_asset_type` (absent/blank → `NULL`, meaning no type — never a guess), plus a symbol row whose `price_symbol` is the normalized order symbol. When the identity is the reserved all-NULL triple the create reuses the seeded default product (multiplier 1 / margin rate 0 / mode `notional` / source `-`), creating it only if missing and never a second one; a contract may attach there, and such symbols carry no broker-scoped spec, so Active Trading orders stay blocked while mapped portfolios work. A create choice also requires `create_source` (`yfinance`/`tfex`/`manual`) and `create_sync_symbol`; an invalid provided type, source or missing provider symbol is `400 Create needs an asset type: stock, future, option, crypto or mutual_fund`, `400 Create needs a price source: yfinance, tfex or manual`, and `400 Create needs the provider symbol (sync_symbol)`. An existing `product_id` choice takes the new symbol's `contract_kind` from the product's asset type (`stock`/`future`/`crypto`/`mutual_fund`), and an option product (`400 Add the option contract in All-assets — a sync row has no expiry, strike or type`) or a product without an asset type (`400 Set the asset type of product {ticker} in All-assets before syncing`) is refused before any write so it can be completed in All Assets. `manual` may omit `create_sync_symbol` and then stores the dashboard symbol as its sync key. Re-applying the same owner is idempotent; provider quote refresh after creation is best effort. Response: `{created, choices}`.

**Margin modes.** Only a local `Active Trading` portfolio recomputes `margin_locked`, per order, from the broker-scoped contract spec. The additive hybrid exception: a mapped portfolio's dashboard-local option rows compute margin with the same formula and it is summed once with the foreign account `margin_locked` (or the stored fallback when the connected read is down); mapped foreign rows are never recomputed and local non-options never contribute. Missing broker/spec/mark/qty contributes zero; options are included; the order's stored `margin_rate` is ignored. Exactly one product `margin_mode` formula applies: `notional` = mark × effective multiplier × qty × effective rate; `premium` = mark × effective multiplier × qty; `span` = qty × the identity's `margin_per_contract` when set, else the premium value. Effective multiplier/rate and the span value all come from the identity (underlying + broker + type) only — the contract cannot override them, and its own `margin_per_contract` column is never read or written. All other portfolio types, and `db=None`, return the stored `margin_locked` unchanged, so registry edits do not move their overview sums. The top-level `multiplier`/`margin_rate` in the risk block are display-only (first resolvable `product_tickers` entry) and never feed margin.

**Order guard.** Creating a local, non-custom, non-mapped `Active Trading` order requires a broker-scoped symbol spec: NULL broker → `400 Assign a broker in Edit portfolio before adding orders`; missing normalized symbol → `400 No contract spec for {SYMBOL} on broker {CODE} — add it in All-assets first`. On `PUT` the guard runs only when `asset_type` changes and resolves the portfolio from the loaded order's own `portfolio_id`, never the optional query parameter. Custom, mapped, Managed Fund, Spread Strategy, and other portfolio types bypass it — except the hybrid mapped option path: a mapped `contract_type="option"` create, and an edit that changes such a row's `asset_type`, explicitly applies the same broker + broker-scoped spec guard while keeping `port_type="Custom Portfolio"`.

**Price sources.** The product's `source` picks the feed; the symbol's `sync_symbol` is the provider key sent to the feed (stored exactly as entered/trimmed, never uppercased, because provider symbols are case-sensitive such as `PTT.BK`). `price_symbol` is the dashboard/order key, not the fetch key. Refresh dispatches on `source` and never fetches `manual`/`-`.

- `yfinance` — Yahoo Finance over direct HTTP (`services/yfinance_service.py`, no `yfinance` library) to avoid rate limiting; returns `(price, change_24h)`.
- `tfex` — TFEX public quotation API (`services/tfex_service.py`). The quotation page is fetched once so Incapsula issues its anti-bot cookies, then `GET https://www.tfex.co.th/api/set/tfex/series/{symbol}/info` is called with JSON `Accept`/`Referer`/`X-Requested-With` headers. A blocked or non-JSON answer is retried once after a forced cookie re-warm. Values are the **delayed** last traded price (roughly 15 minutes behind the exchange), not a live tick. `sync_symbol` may be the series code (`S50Z26`, `USDX26C34.00`) or the TFEX product-page URL (`https://www.tfex.co.th/en/products/.../USDX26C34.00/intraday`). Failures raise fixed messages — unknown or expired series, no usable quote, or blocked request — which `update-price` surfaces as HTTP 502; batch refresh skips the ticker. Halted or illiquid series with a null `last` are priced from the bid/offer mid, then the settlement price, then the prior settlement price (percent change computed against that prior settlement).
- `manual` — never fetched; `update-price` only refreshes `updated_at`.

### Asset Groups
Asset groups are retired from the UI: the endpoints and the `asset_groups` table remain for compatibility, but nothing in the product uses them and `asset_products.group_id` is no longer written. `GET` returns the stored rows and no longer seeds the `Ungrouped`/`Watchlist` defaults.

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/asset-groups` | List asset groups (returns the stored rows; no seeding) |
| `POST` | `/api/v1/asset-groups` | Create a new group |
| `PUT` | `/api/v1/asset-groups/{id}` | Update group name (default groups cannot be edited; duplicate name is a 400) |
| `DELETE` | `/api/v1/asset-groups/{id}` | Delete group (default groups cannot be deleted) |

### Orders Groups
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/orders-groups` | List groups for a portfolio (supports `?portfolio_id=`) |
| `POST` | `/api/v1/orders-groups` | Create a group |
| `PUT` | `/api/v1/orders-groups/{id}` | Update a group |
| `DELETE` | `/api/v1/orders-groups/{id}` | Delete a group |

### Trade History
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/api/v1/trade-history` | List records (optional `?portfolio_id=`). A mapped portfolio merges dashboard `trade_history` with the foreign `history` entity, sorts `exit_date` desc → dashboard before mapped → `history_key` asc, then applies `offset`/`limit`; every row carries `history_source` and a string `history_key` alongside the legacy integer `history_id`. Foreign `remark.note` is `Close` or `Canceled` |
| `POST` | `/api/v1/trade-history` | Create record (409 for a mapped portfolio — read-only) |

### Other
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET/POST` | `/api/v1/trade-plans` | Trade plan CRUD |
| `DELETE` | `/api/v1/trade-plans/{plan_id}` | Delete trade plan |
| `GET/POST` | `/api/v1/journal` | Decision journal |
| `GET/POST` | `/api/v1/rebalance/*` | Rebalance engine |

---

## Project Structure

```text
backend/
├── app/
│   ├── main.py                  # FastAPI app + lifespan (create tables, run asset-registry migration, register managed_fund_models)
│   ├── database.py              # Async engine + session factories + custom engine manager
│   ├── models.py                # SQLAlchemy ORM models (incl. asset_products/asset_symbols/asset_quotes + CustomPortfolioConnection)
│   ├── asset_registry_migration.py # One-transaction legacy whitelist→registry conversion, assertions, DROP
│   ├── custom_models.py         # FK-free models for custom DB tables (active_orders, transactions, trade_plans, etc.)
│   ├── managed_fund_models.py   # 4 SQLAlchemy models for Managed Fund (holdings, orders, order history, settings)
│   ├── utils/
│   │   ├── crypto.py            # Fernet encrypt/decrypt for DB passwords
│   │   └── __init__.py
│   ├── services/
│   │   ├── asset_registry.py    # Normalized product/symbol resolution, CRUD helpers, quotes, rename, proposal
│   │   ├── yfinance_service.py  # Direct HTTP to Yahoo Finance (no yfinance library)
│   │   └── tfex_service.py      # TFEX quotation API: cookie warm-up, one retry, delayed quote
│   └── routers/
│       ├── portfolios.py        # Portfolio CRUD + test-connection + connection management
│       ├── active_orders.py     # Order management (create, update, close, link, unlink)
│       ├── analytics.py         # Portfolio grid + detail analytics
│       ├── performance.py       # Equity curve + payoff bars
│       ├── overview.py          # Global dashboard
│       ├── transactions.py      # Transaction history (global + per-portfolio routing)
│       ├── trade_history.py     # Historical trade records
│       ├── transfers.py         # Cash pool transfers
│       ├── assets.py            # Product/symbol/quote CRUD, proposal/apply, price refresh; custom flat branch
│       ├── asset_groups.py      # Asset group CRUD (retired from the UI; compatibility only)
│       ├── orders_groups.py     # Orders group CRUD
│       ├── trade_plans.py       # Trade plan CRUD
│       ├── journal.py           # Decision journal
│       ├── managed_funds.py     # Managed Fund CRUD: settings, holdings, orders, history, rebalance, sync-prices, alerts
│       └── rebalance.py         # Dual-mode rebalancing
├── tests/                       # pytest suite (collected from this directory only)
├── pytest.ini                   # testpaths = tests
├── requirements.txt             # runtime deps (cryptography included for Fernet password encryption)
├── requirements-dev.txt         # dev/test deps (pytest, httpx, ...)
├── Dockerfile                   # python:3.11-slim runtime; ARG INSTALL_DEV adds dev deps
├── .dockerignore
└── README.md
```

---

## Custom Portfolio – Multi-Database Architecture

### Architecture Overview

```
investment_main (Control Plane)
  ├── portfolios                    ← metadata + is_custom flag
  ├── custom_portfolio_connections  ← encrypted credentials (Fernet)
  ├── trade_plans                   ← shared config
  └── ... (core tables)

External DB (Data Plane) — ONE per Custom Portfolio
  either OWNED (the backend creates these) …
  ├── active_orders                 ← FK-free (portfolio_id as plain Integer)
  ├── transactions
  ├── trade_plans                   ← FK-free replica (avoids plan_id FK errors)
  ├── whitelist_assets            ← legacy flat layout, external DB only (not the main registry)
  ├── asset_groups
  └── orders_groups
  … or MAPPED (read-only over an existing broker schema; no DDL)
```

### How it works

1. **Creation**: User creates a `Custom Portfolio` via `POST /api/v1/portfolios` with `db_host`, `db_port`, `db_name`, `db_user`, `db_password`. Password is encrypted with Fernet (`FERNET_KEY` env var) before storage in `custom_portfolio_connections`.

2. **First access**: Backend lazy-connects to the external DB on the first API request for that portfolio. Creates FK-free table replicas via `custom_models.metadata.create_all()`.

3. **Routing**: `resolve_portfolio_db(db, portfolio_id)` in `database.py` detects `is_custom=True` and returns a session bound to the external DB engine. Engines are cached 30 minutes (`CUSTOM_ENGINES` dict); a credential change through `PATCH /{id}/connection` evicts that cache entry (`evict_custom_engine`) so the next request rebuilds it. Replaces the removed `get_custom_session_maker`.

4. **Auto-migration**: `ensure_custom_tables()` is called on first access for each custom portfolio. It queries `information_schema.columns` for each custom table, runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for any columns missing from the external DB, and drops all FK constraints via `ALTER TABLE ... DROP CONSTRAINT` to match the FK-free model design (required because main-DB IDs don't exist in external DBs).

5. **Global queries**: `GET /api/v1/transactions` without `portfolio_id` aggregates from `investment_main` + all custom DBs via `asyncio.gather(return_exceptions=True)`. Failed nodes are skipped and reported as `failed_portfolios` in response.

6. **Security**: Passwords encrypted with Fernet, never stored in plaintext. `test-connection` endpoint validates credentials without persisting them.

### Read-through mapping (orders writable when mapped)

A non-null `custom_portfolio_connections.mapping_config` (JSON) turns the same Custom Portfolio into a view over an existing broker schema; `null` keeps the owned-tables behaviour above. The mapping lives in `investment_main` only. Foreign active orders are writable only when `entities.orders.write` is present; everything else stays read-only except dashboard-local option orders on a mapped portfolio (see *Hybrid mapped options* below).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/portfolios/mapping-templates` | Built-in templates; `tfex-settrade-v1` maps `usd_pct_abc.opened_orders` / `order_history` / `account_history`. The returned `config` is stored verbatim |
| `GET /api/v1/portfolios/{id}/connection` | Connection metadata + `mapping_config`; never the password |
| `POST /api/v1/portfolios/{id}/test-connection` | Stored credentials, optional `mapping_config` override, `diagnostics` in the response |

- **Validation**: `validate_mapping` refuses a `version` other than 1, a missing `orders`/`account` entity, and any schema/table/column that is not a plain SQL identifier — the config can only ever name a quoted identifier, never carry SQL.
- **No DDL**: `get_custom_session` / `get_portfolio_db` skip `ensure_custom_tables()` when `mapping_config` is set, so our `active_orders`/`transactions` tables are never created in the foreign database.
- **Reads**: the grid maps orders (`status` `M`/`MP`→`open`, `C*`→`cancelled`, `E*`→`expired`, `R*`→`rejected`; `tp` is the exit price; `remark` is the Mark note), the newest `account_history` row supplies `available_cash`←`excessequity`, `margin_locked`←`initialmargin`, `current_nav`←`equity`. `GET /api/v1/orders` returns the foreign rows plus dashboard-local option rows (normalized `contract_type == option`), each tagged `order_source`; `GET /api/v1/trade-history` returns the foreign `history` rows (`remark.note` = `Close`/`Canceled`) merged with dashboard `trade_history`, each tagged `history_source`/`history_key`. The union, sort and pagination rules are shared with analytics and performance.
- **Prices and P&L**: the mapped `orders` entity maps `mark_price` → a display-only `mark_price` that the mapped ladder's `Mark` column shows; `current_price` is not mapped. Net P&L and the risk block's Sum P/L (`risk.pl_total`) use the local registry price: normalized `asset_symbols.price_symbol` in the portfolio's broker scope joined to `asset_quotes.price`, the portfolio's `broker_id` preferred and otherwise the lowest `broker_id`. A `NULL` price is missing (the order falls back to its entry price, so its Net P&L is 0; the foreign mark is never substituted). `tp` remains an exit price only and never enters P/L. The mapped risk proxy carries `port_type='Mapped'`; the risk block's `margin_locked` is the foreign account `initialmargin` plus the dashboard-local option margin from broker-scoped specs, and `available_cash` stays the foreign `excessequity`.
- **No auto-sync**: the legacy order-derived `sync-from-orders`/`sync-from-all` writers are removed — both routes return `404`. `GET /api/v1/assets/proposal` only reads distinct normalized order symbols across main, owned-custom, and mapped portfolios (the mapped adapter is read-only and `ensure_custom_tables()` is never called on a foreign database); Managed Fund holdings and still-open fund orders are proposal sources too (merged by the same pair key; fund history and `done`/`cancelled` orders are not). Nothing is written until the user calls `POST /api/v1/assets/apply` with explicit choices; an unreachable custom database is skipped while building the proposal.
- **Order writes (optional `write` block)**: `entities.orders.write` declares `key` (`column`, `generated`), `insert`/`update`/`delete` flags, `columns` (canonical→foreign, unique, never the generated key), literal `defaults`, and `values` (canonical literal → foreign literal, e.g. `BUY`→`LONG`). Identifiers and shapes are validated by `validate_mapping`; every identifier is quoted and every value bound. The row key is the uuid `id` returned by `INSERT ... RETURNING`; the normalised order exposes it as `order_id` and maps `orderno` to `order_ref`. Update raises 400 for a non-null field outside `write.columns`; there is no plain delete path when a history spec exists.
- **Close / cancel**: `POST /close` and `PATCH /status` (`CANCELED`) require `?order_source=dashboard|mapped` on a mapped portfolio. Source `mapped` runs in one foreign transaction — read the open row, INSERT a copy into `write.history` (base values via `history.columns`, `defaults`, the `history.status` code, and `close_columns` for exit price / realized P/L), then DELETE the open row. Without a `write.history` block the operation is a plain delete. Response shape: `{order_id, order_status: CLOSE|CANCELED, history_id: null}`. Source `dashboard` looks only at dashboard `active_orders` rows with `contract_type="option"` and writes one main `trade_history` row in the same main-DB transaction; mapped rows are untouched.
- **Hybrid mapped options**: an order is local when its normalized `contract_type` is `option` (never `asset_type`). `POST /orders` with that contract type inserts main `active_orders` + the default main `trade_plan` after the strict broker + broker-scoped `price_symbol` spec guard (same 400 messages as Active Trading); the portfolio stays `port_type="Custom Portfolio"`. Non-option creates keep the foreign writer and `_writable_values`; an option payload never reaches those capabilities, even when the mapping is read-only. Single-row `GET`/`PUT`/`status`/`close` on a mapped portfolio require `order_source`; missing/unknown is `400 Order source is required for a mapped portfolio: dashboard or mapped`, an absent row in the named store is `404`, and no route probes or falls back to the other store. A key the foreign row-key column cannot encode (driver `DataError`/`StatementError`, e.g. a local 10-character id bound into a UUID column) is also `404` as "not present in that store"; a genuine connection failure keeps its existing error behavior and is never turned into a 404. Order identity is `(order_source, order_id)`; history identity is `(history_source, history_key)` where the local key is `str(history_id)` and the mapped key is `str(mapped history_id)` when configured, else a deterministic content fingerprint plus an occurrence ordinal. Merge order is `created_at` desc (nulls last) → dashboard before mapped → `order_id` asc for orders, and `exit_date` desc (nulls last) → dashboard before mapped → `history_key` asc for history, with `offset`/`limit` applied after the union. No table, column, migration or row copy is added. Setup per mapped portfolio: assign `broker_id` in Edit Portfolio and add the option contract (with its call/put, expiry and strike terms) to that broker's All-assets registry.
- **Write refusal**: a mapped config without a `write` block keeps the old 409; an operation the block does not enable (missing `insert`/`update`/`delete`) is also `409 Portfolio is read-only (mapped external database)`. Link/unlink, assets, order groups, trade plans, trade history and ledger transactions still call `raise_if_mapped_readonly` and answer 409. The grid keeps `read_only: true` and `mapping_template`, and reports the store-scoped `order_writes` `{mapped: {insert, update, delete, fields, key_generated} | null, dashboard_options: {insert, update, delete}}`; the frontend gates mapped order affordances on `order_writes.mapped` and dashboard option affordances on `order_writes.dashboard_options`. When the foreign database is unreachable, the degraded analytics row keeps dashboard-local option orders/history, sets `load_error`, reports `mapped: null`, and keeps `dashboard_options` true.
- **Diagnostics**: a test with a mapping returns `orders_rows`, `history_rows`, `account_rows`, one normalised `sample_order`, and per-entity `errors` — the row counts and the first broken entity, instead of a bare success.
- **Dev fixture**: `database/mock/usd_pct_abc_dev_seed.sql` (idempotent; 6 open orders, 4 history rows, 3 account snapshots).

---

## Hands-On Tests

```bash
# Health check
curl http://localhost:8000/health

# Create a standard portfolio
curl -X POST http://localhost:8000/api/v1/portfolios \
  -H "Content-Type: application/json" \
  -d '{"portfolio_name":"Binance Grid","port_type":"Active Trading"}'

# Create a custom portfolio (with external DB)
curl -X POST http://localhost:8000/api/v1/portfolios \
  -H "Content-Type: application/json" \
  -d '{
    "portfolio_name":"Self-Hosted Futures",
    "port_type":"Custom Portfolio",
    "db_host":"192.168.1.100",
    "db_port":5432,
    "db_name":"custom_futures",
    "db_user":"dashboard",
    "db_password":"secret123"
  }'

# Test external connection
curl -X POST http://localhost:8000/api/v1/portfolios/test-connection \
  -H "Content-Type: application/json" \
  -d '{"db_host":"192.168.1.100","db_port":5432,"db_name":"custom_futures","db_user":"dashboard","db_password":"secret123"}'

# Fetch a symbol quote (price_symbol is the dashboard key; sync_symbol is the provider key)
curl -X POST http://localhost:8000/api/v1/assets/symbols/1/update-price
```

> **Tip:** Open `http://localhost:8000/docs` for interactive Swagger UI.

### Automated tests

`pytest` collects from `tests/` only (`testpaths = tests` in `pytest.ini`). Dev/test dependencies come from `requirements-dev.txt` and are not part of the runtime image unless it is built with `ARG INSTALL_DEV=true`.

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

---

## Advanced Usage

### Rebuilding the Backend Image

```bash
# From the repository root
podman build -t investment-dashboard/backend:dev backend
kind load docker-image --name investment-dashboard investment-dashboard/backend:dev
kubectl -n investment-dashboard rollout restart deploy/backend
```

> Use `podman build --no-cache` when crypto.py, database.py, or requirements.txt changes.

### Accessing the Database

```bash
# Forward the Postgres Service to the host, then connect
kubectl -n investment-dashboard port-forward svc/postgres-main 5432:5432

# Main database
psql -h localhost -p 5432 -U dashboard -d investment_main
```

### Viewing Logs

```bash
kubectl -n investment-dashboard logs -f deploy/backend
kubectl -n investment-dashboard logs -f statefulset/postgres-main
```

### Swagger UI

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## Troubleshooting

### API Not Responding

```bash
kubectl -n investment-dashboard get pods
kubectl -n investment-dashboard logs deploy/backend
curl http://localhost:8000/health
```

### Yfinance Returns 0.0

The yfinance service uses direct HTTP to Yahoo Finance. If prices return 0.0, the API has likely been rate-limited. Wait a few minutes and retry. The frontend caches the last known price in `localStorage('cached_price_{price_symbol}')` (and under the sync symbol when the two differ).

### TFEX Quote Fails

`POST /api/v1/assets/symbols/{symbol_id}/update-price` returns `502 Failed to fetch price: <fixed message>` for a `source = 'tfex'` product:

- *unknown or expired symbol* — the series API answered 404. Check `sync_symbol` (e.g. `CPALLZ25`) against a live TFEX series; expired contracts have no quote.
- *no usable quote* — the payload had no positive `last`, bid/offer pair, `settlementPrice`, or `priorSettlementPrice` (the series is not trading yet).
- *blocked* — the request came back as an anti-bot HTML page twice (initial call plus one forced cookie re-warm). Wait and retry; a long block usually means the quotation endpoint is rate-limiting the host.

TFEX quotes are delayed by roughly 15 minutes, so the fetched value will not match a live trading screen.

### Custom Portfolio Connection Fails

- Verify `FERNET_KEY` is set in the environment
- Check `test-connection` endpoint with the same credentials
- For a mapped portfolio, `POST /api/v1/portfolios/{id}/test-connection` names the broken entity in `diagnostics.errors` (e.g. `orders: ...`) and reports `orders_rows`/`history_rows`/`account_rows`
- Ensure the external PostgreSQL accepts connections from the cluster pod network
- Check logs: `kubectl -n investment-dashboard logs deploy/backend`

### Database Connection Issues

```bash
kubectl -n investment-dashboard get pods
kubectl -n investment-dashboard logs statefulset/postgres-main
```

---

*Last updated: 24 November 2026 (broker-scoped `asset_products`/`asset_symbols`/`asset_quotes` registry replacing main `whitelist_assets`; startup conversion + drop; product/symbol/proposal/apply contracts and error texts; margin modes and Active Trading order guard; product-ticker rename rule; removed flat main routes and sync endpoints; read-through Custom Portfolios retained)*
