-- init.sql
-- This script will be executed as the Postgres superuser on first start
-- Create useful extension and example table for quick initial testing

-- Enable uuid generation extension if needed (not strictly required for gen_random_uuid in Postgres 13+)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Example: create a sample table that mirrors the model used by the server.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Example: insert a test record if none present
INSERT INTO users (email, name) 
SELECT 'test@example.com', 'Test User' WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);
