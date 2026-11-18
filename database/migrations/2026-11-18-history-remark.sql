-- Migration: keep the originating order's free-text remark on trade_history (separate from the JSON remark payload)

ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS order_remark VARCHAR;
