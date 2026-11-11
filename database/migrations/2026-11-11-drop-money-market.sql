-- Migration: drop the Money market cash bucket from portfolios
-- Date: 2026-11-11
--
-- WHY the value is FOLDED instead of dropped outright:
--   Money market was one of the cash buckets counted by the equity/NAV formulas
--   (total_equity = margin + buffer + available_cash + money_market + total_pl,
--   and NAV = available_cash + money_market + holdings_value). Deleting the
--   column while its value is still sitting outside available_cash would make
--   every portfolio's equity drop by its money-market balance. Folding the
--   balance into available_cash first keeps total_equity and NAV numerically
--   identical before and after the migration, while the breakdown now has
--   three buckets: margin, buffer, available_cash.
--
-- ORDER MATTERS: run this migration BEFORE (or together with) deploying the
-- schema/model change that removes the column. The fold is guarded so it can
-- never run twice (a second run would double the balance), and the drop uses
-- IF EXISTS so the script is safe to re-run.
--
-- HOW TO RUN (kind cluster, main PostgreSQL):
--   The values of POSTGRES_USER / POSTGRES_DB are resolved inside the pod, so
--   the file is piped through the container shell on stdin:
--
--     kubectl -n investment-dashboard exec -i postgres-main-0 -- \
--         sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' \
--         < database/migrations/2026-11-11-drop-money-market.sql
--
--   Equivalent form when POSTGRES_USER / POSTGRES_DB are already exported in
--   your local shell:
--
--     kubectl -n investment-dashboard exec -i postgres-main-0 -- \
--         psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f - \
--         < database/migrations/2026-11-11-drop-money-market.sql
--
--   Optional equity check around the migration: capture
--     SELECT portfolio_id, margin_locked, cash_buffer_limit, available_cash,
--            money_market FROM portfolios ORDER BY portfolio_id;
--   before, then the same columns without money_market after. The sum
--   margin + buffer + available_cash must be identical on both sides.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'portfolios'
          AND column_name = 'money_market'
    ) THEN
        UPDATE portfolios
        SET available_cash = COALESCE(available_cash, 0) + COALESCE(money_market, 0);

        ALTER TABLE portfolios DROP COLUMN IF EXISTS money_market;
    END IF;
END
$$;
