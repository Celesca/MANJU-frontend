-- init.sql
-- This script will be executed as the Postgres superuser on first start
-- Create useful extension and example table for quick initial testing

-- Enable uuid generation extension (uuid-ossp or pgcrypto)
-- uuid-ossp requires the extension to be available, which is present on most images
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Alternatively, you can install pgcrypto and use gen_random_uuid():
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Example: create a schema/user. When using the Docker official image, the env
-- variable POSTGRES_USER is created as superuser. We create an example DB role
-- and grant privileges.
-- Replace the following with environment-specific values if needed.

-- Create a sample database and user (if not already provided by POSTGRES_DB/POSTGRES_USER)
-- These are just convenience SQL commands — the Docker image already creates the
-- database and user based on env vars.

-- Create a sample table that mirrors the model used by the server.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Example: insert a test record if none present
INSERT INTO users (email, name) 
SELECT 'test@example.com', 'Test User' WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);
