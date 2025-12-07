# Minimal Dockerfile to initialize a Postgres container with initialization scripts
# We extend the official Postgres image and copy initialization SQL.
FROM postgres:15-alpine

# Add a directory where we copy initialization scripts. The official image executes
# scripts in /docker-entrypoint-initdb.d when the database is first created.
COPY ./init/ /docker-entrypoint-initdb.d/

# Expose Postgres default port
EXPOSE 5432

# Use default postgres entrypoint — configuration and env such as POSTGRES_DB will
# be handled via environment variables or docker-compose when starting the container.
