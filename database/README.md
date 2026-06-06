# Investment Dashboard – Database Schemas

Two PostgreSQL databases power the system:

## Main DB (`investment_main`) — `main_db_schema.sql`

12 tables for portfolio management, trade execution, and ledger:

| Table | Purpose |
|-------|---------|
| `portfolios` | Portfolio config: name, type, cash fields (`available_cash`, `money_market`, `margin_locked`, `cash_buffer_limit`), `risk_status`, `tags` (JSONB), `internal_notes` (yellow sticky), `trade_plan_md` |
| `portfolio_nav_history` | NAV time-series per portfolio |
| `trade_plans` | Per-portfolio trade plan: entry/exit zones, leverage, margin rate, TP/SL levels |
| `option_details` | Greeks & pricing: strike, premium, delta, IV, theta, gamma, vega, rho |
| `active_orders` | Open positions: `order_id` TEXT (UUID), `group_id` FK→`orders_groups`, `linked_order_id` TEXT, `contract_type` (spot/future/option), `option_type` (Call/Put), `expiry_date`, `strike_price`, `cost`, `option_id` FK→`option_details`. Side: `BUY`/`SELL` for spot, `LONG`/`SHORT` for futures/options (`direction` field removed). `link_type` is computed server-side (not stored) |
| `simulation_models` | Draft rebalance/simulation data per portfolio |
| `trade_history` | Closed/canceled order records: `order_id`, `close_order_id`, `group_id`, `realized_pl`, `exit_price`, timestamps |
| `orders_groups` | Group definitions: `name`, `max_orders`, `min_price`, `max_price`, `range` (was Zone Groups) |
| `whitelist_assets` | Approved asset tickers |
| `watchlist` | Price alerts per ticker |
| `transactions` | Consolidated ledger: deposits, withdrawals, transfers |
| `decision_journals` | Mini post-it notes per portfolio, linked to trade history |

### Key columns on `active_orders`

- `order_id TEXT PRIMARY KEY` — UUID string, client-provided or auto-generated
- `linked_order_id TEXT` — one-way link (pending close) or cross-link (spread pair). Cross-link detected when `A.linked_order_id = B.order_id AND B.linked_order_id = A.order_id`
- `group_id INTEGER FK → orders_groups(id)` — zone grouping
- `contract_type TEXT` — `'spot'`, `'future'`, or `'option'`
- `option_type TEXT` — `'Call'` or `'Put'` for options
- `side TEXT` — `'BUY'`/`'SELL'` for spot, `'LONG'`/`'SHORT'` for futures/options (`direction` column still exists as nullable in schema but removed from frontend types)
- `expiry_date TIMESTAMP` — for futures/options
- `strike_price NUMERIC(20,8)` — for options
- `cost NUMERIC(20,8)` — cost basis

## AI DB (`investment_ai`) — `ai_db_schema.sql`

3 tables for AI agent orchestration:

| Table | Purpose |
|-------|---------|
| `ai_agents` | Agent profiles: name, model, strategy config, target portfolio |
| `ai_action_logs` | Execution audit: SCAN/PLAN/EXECUTE/ADJUST actions, reasoning, confidence, linked orders |
| `ai_agent_state` | Runtime state: last run, current task, busy flag, error logs |

## Notes

- `portfolios.available_cash` is auto-adjusted by the frontend when Money Market/Margin Locked/Cash Buffer Limit change in Edit Portfolio: `newAvailable = rawAvailableCash - totalDiff` (diff of new vs old deduction values)
- **Both databases get all 15 tables created**: the `lifespan` handler calls `Base.metadata.create_all` on both engines, so `investment_main` and `investment_ai` both contain every table. The AI tables (`ai_agents`, `ai_action_logs`, `ai_agent_state`) are functionally isolated by connection.
- **`direction` column**: still exists as a nullable `TEXT` column in `active_orders` (schema & ORM). It was removed only from frontend TypeScript types. The `side` field (`BUY`/`SELL`/`LONG`/`SHORT`) is the canonical direction indicator.
- **`AiActionLog.linked_order_id`** is `INTEGER` in the ORM model, but `active_orders.order_id` is `TEXT` (UUID). This is a type mismatch — `linked_order_id` in action logs should be `TEXT` to match the UUID primary key of the referenced order.
- `available_cash`, `money_market`, `margin_locked`, `cash_buffer_limit` are all `NUMERIC(20,8)` columns and can be `NULL` (frontend defaults to `0`)
- `link_type` is NOT stored — computed server-side by `analytics.py._link_type()`:
  - `"spread"` — cross-linked (A↔B)
  - `"pending_close"` — one-way sub (B→A)
  - `"primary"` — has subs linking to this order
  - `"none"` — no linking
- Performance endpoint (`GET /api/v1/analytics/performance/{id}`) returns `payoff_data[]` grouped by **month** with summed `realized_pl` — one bar per month, not per trade
- Order status: `PENDING`, `FILLED` (non-terminal), `CLOSE`, `CANCELED` (terminal)
- Frontend Options Strategy state is saved per-portfolio in localStorage (`payoff_{key}_{portfolio_id}`) — no backend storage for strategy sandbox data
- IV values for active orders are frontend-only (entered in Controls panel, saved to per-portfolio localStorage) — not stored in `option_details`

---

*Last updated: 6 June 2026 (schema stable; Transaction.created_at default=utcnow used as display datetime on frontend)*
