FROM golang:1.24 AS builder

WORKDIR /src

# Cache modules
COPY go.mod go.sum ./
RUN go env -w GOPROXY=https://proxy.golang.org
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/main ./

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/main /app/main
COPY --from=builder /src/.env ./.env
EXPOSE 8080
ENV GIN_MODE=release
CMD ["/app/main"]
