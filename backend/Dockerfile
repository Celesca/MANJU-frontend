FROM golang:1.24-alpine

WORKDIR /app

# Install git and build dependencies for go
RUN apk add --no-cache git build-base

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Using go run main.go as requested by the user
CMD ["go", "run", "main.go"]
