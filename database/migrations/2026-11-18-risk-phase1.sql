-- Migration: risk model phase 1 data layer
-- Adds brokers, contract specs on whitelist_assets, and portfolio product/X/initial capital.
--
-- Product spec key is (broker_id, ticker) - one row per instrument, because the
-- price feed (batchUpdatePrices) is singular per ticker. Known limitation: spot
-- and future on one underlying share one multiplier/margin_rate row (asset_type
-- holds an instrument class such as 'crypto', and contract_type is stored on
-- active_orders, so it cannot separate specs yet). Options use premium only and
-- never multiplier/margin in this model. Revise the key if futures and options
-- on the same underlying must diverge.
--
-- All statements are idempotent; the API also runs this at startup.

CREATE TABLE IF NOT EXISTS brokers (
    id SERIAL PRIMARY KEY,
    code VARCHAR NOT NULL UNIQUE,          -- 'DF', 'PI', 'CAF'
    name VARCHAR NOT NULL,
    default_margin_rate NUMERIC(10,6) DEFAULT 0,
    currency VARCHAR DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO brokers (code, name) VALUES ('DF', 'Unassigned')
ON CONFLICT (code) DO NOTHING;

-- Contract spec columns on the asset row.
ALTER TABLE whitelist_assets ADD COLUMN IF NOT EXISTS broker_id INTEGER;
ALTER TABLE whitelist_assets ADD COLUMN IF NOT EXISTS multiplier NUMERIC(20,8) NOT NULL DEFAULT 1;
ALTER TABLE whitelist_assets ADD COLUMN IF NOT EXISTS margin_rate NUMERIC(10,6) NOT NULL DEFAULT 0;
UPDATE whitelist_assets SET broker_id = (SELECT id FROM brokers WHERE code = 'DF')
WHERE broker_id IS NULL;

-- Replace the old single-column unique ticker with the composite spec key.
ALTER TABLE whitelist_assets DROP CONSTRAINT IF EXISTS whitelist_assets_ticker_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_broker_ticker ON whitelist_assets (broker_id, ticker);

-- Portfolio product / X / initial capital.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS broker_id INTEGER;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS product_ticker VARCHAR;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS x_amount NUMERIC(20,8) NOT NULL DEFAULT 0;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS initial_capital NUMERIC(20,8) NOT NULL DEFAULT 0;

-- Backfill Active Trading portfolios: default broker, dominant order ticker, capital base.
UPDATE portfolios p SET broker_id = (SELECT id FROM brokers WHERE code = 'DF')
WHERE p.broker_id IS NULL AND p.port_type = 'Active Trading';

UPDATE portfolios p SET product_ticker = (
    SELECT a.asset_type FROM active_orders a WHERE a.portfolio_id = p.portfolio_id
    GROUP BY a.asset_type ORDER BY count(*) DESC LIMIT 1
)
WHERE p.product_ticker IS NULL AND p.port_type = 'Active Trading';

UPDATE portfolios SET initial_capital = available_cash WHERE initial_capital = 0;
