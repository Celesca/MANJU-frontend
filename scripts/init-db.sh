#!/bin/bash

# Usage: ./scripts/init-db.sh <db_host> <db_user> <db_password> <db_name>

DB_HOST=$1
DB_USER=$2
DB_PASSWORD=$3
DB_NAME=$4

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
  echo "Usage: ./scripts/init-db.sh <db_host> <db_user> <db_password> <db_name>"
  exit 1
fi

echo "Initializing database $DB_NAME on $DB_HOST..."

# Check if psql is installed
if command -v psql &> /dev/null; then
    echo "Using local psql client..."
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f ../backend/server/db/init/init.sql
# Fallback to Docker if psql is not found
elif command -v docker &> /dev/null; then
    echo "psql not found. Using Docker to run psql..."
    
    # On Windows/Git Bash, paths need special handling for Docker
    # We use pwd -W to get the Windows-style path if available (Git Bash feature)
    if pwd -W > /dev/null 2>&1; then
        PROJECT_ROOT=$(cd .. && pwd -W)
    else
        PROJECT_ROOT=$(cd .. && pwd)
    fi

    echo "Project root: $PROJECT_ROOT"

    # Use MSYS_NO_PATHCONV to prevent Git Bash from messing with the /work path
    MSYS_NO_PATHCONV=1 docker run --rm \
        -v "$PROJECT_ROOT:/work" \
        -w /work \
        -e PGPASSWORD=$DB_PASSWORD \
        postgres:15-alpine \
        psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f backend/server/db/init/init.sql

else
    echo "Error: Neither 'psql' nor 'docker' was found. Please install one of them to initialize the database."
    exit 1
fi

echo "Database initialization complete!"

