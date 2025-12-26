package middleware

import (
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// APIKeyGuard is a middleware that validates the X-API-Key header
func APIKeyGuard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip for OPTIONS (CORS preflight)
		if c.Method() == "OPTIONS" {
			return c.Next()
		}

		// Skip for auth routes (OAuth login/callback are browser redirects)
		path := c.Path()
		if strings.HasPrefix(path, "/auth/") {
			return c.Next()
		}

		apiKey := strings.TrimSpace(os.Getenv("MANJU_API_KEY"))
		if apiKey == "" {
			// If not set, allow all (safety for initial setup)
			log.Println("[APIKeyGuard] MANJU_API_KEY not set, allowing request")
			return c.Next()
		}

		clientKey := c.Get("X-API-Key")

		// Debug logging - remove in production
		log.Printf("[APIKeyGuard] Path: %s, Expected Key: %s, Received Key: %s", path, apiKey, clientKey)

		if clientKey == "" || clientKey != apiKey {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized: missing or invalid API Key",
			})
		}

		return c.Next()
	}
}
