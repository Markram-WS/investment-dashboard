-- Migration: add active_orders.remark and rename trade_history.comments to remark (JSON payload unchanged)

ALTER TABLE active_orders ADD COLUMN IF NOT EXISTS remark VARCHAR;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'trade_history'
          AND column_name = 'comments'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'trade_history'
          AND column_name = 'remark'
    ) THEN
        ALTER TABLE trade_history RENAME COLUMN comments TO remark;
    END IF;
END
$$;
