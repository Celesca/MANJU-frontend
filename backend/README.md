# Server (Go + Fiber + GORM)

This folder contains a minimal Go server using the Fiber web framework and GORM ORM.
The server exposes a `User` model and CRUD endpoints under `/users`.

## Requirements
- Go 1.21+
- (Optional) Postgres for production. By default the server uses SQLite database file `dev.db` if `DATABASE_URL` is not set.

## Run

### Run once
```bash
# Set environment variables (optional) or copy .env.example to .env
cp .env.example .env

export $(cat .env)

# build and run
go run ./main.go
```

### Run with Air (hot reload)
```bash
# Install air: go install github.com/cosmtrek/air@latest
# Then run air in the server/ directory
air -c air.toml
```

### Run Postgres in Docker (recommended for development)
You can run a Postgres server in Docker for local development. We include a Dockerfile and docker-compose file
in `server/db` and `server/docker-compose.yml` for convenience. The compose file mounts a persistent volume and
copies initialization SQL scripts to create the `users` table + enable the `uuid-ossp` extension.

1. Make sure Docker Desktop or Docker Engine is installed.
2. From `server` directory run:
```bash
docker compose up --build -d
```
3. Validate the DB is healthy:
```bash
docker compose ps
docker logs $(docker compose ps -q db)
```
4. Copy `.env.example` to `server/.env` (or create `server/.env`) and set credentials if you want. By default the service uses `POSTGRES_USER=postgres` and `POSTGRES_PASSWORD=postgres`.

Note on host vs container connectivity:
- If you run the DB via Docker but run the Go server on your host machine (outside containers), use `localhost` in `DATABASE_URL` (e.g. `postgres://postgres:postgres@localhost:5432/manju_dev?sslmode=disable`).
- If you run the Go server inside a container in the same Docker network, use the compose service name `db` as the host (e.g. `postgres://postgres:postgres@db:5432/manju_dev?sslmode=disable`).

The compose + Dockerfile uses the standard Postgres image and puts the `init.sql` script in `/docker-entrypoint-initdb.d`, so the `users` table and `uuid-ossp` extension will be present on first run.

## API

## Notes
- The GORM model uses `uuid` and stores `Info` as JSONB in Postgres. For SQLite, `Info` will still be stored as JSON string.
- If you want to use Postgres locally, set `DATABASE_URL` in `.env`.
