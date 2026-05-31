-- AI Agent Database Schema (Isolated)
-- For use with the AI agent DB (investment_ai)

-- 1. Agent Profiles & Config
CREATE TABLE IF NOT EXISTS ai_agents (
    agent_id SERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,
    model_name TEXT NOT NULL,
    target_portfolio_id INTEGER,
    strategy_config JSONB,
    status TEXT CHECK (status IN ('Active', 'Paused', 'Emergency_Stop')) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Execution & Audit Logs (The Brain Logs)
CREATE TABLE IF NOT EXISTS ai_action_logs (
    log_id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES ai_agents(agent_id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('SCAN', 'PLAN', 'EXECUTE', 'ADJUST')),
    reasoning TEXT,
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    raw_data_snapshot JSONB,
    linked_plan_id INTEGER,
    linked_order_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Runtime State & Errors
CREATE TABLE IF NOT EXISTS ai_agent_state (
    agent_id INTEGER PRIMARY KEY REFERENCES ai_agents(agent_id) ON DELETE CASCADE,
    last_run_timestamp TIMESTAMP,
    current_task TEXT,
    is_busy BOOLEAN DEFAULT FALSE,
    error_logs TEXT
);