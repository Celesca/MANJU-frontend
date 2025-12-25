FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git build-base

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build the application
RUN go build -o main main.go

# Use a smaller image for production
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache ca-certificates

COPY --from=builder /app/main .
COPY --from=builder /app/.env* ./

# Expose port
EXPOSE 8080

CMD ["./main"]

