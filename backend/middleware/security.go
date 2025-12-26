package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// APIKeyGuard is a middleware that validates the X-API-Key header
func APIKeyGuard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip for options (CORS)
		if c.Method() == "OPTIONS" {
			return c.Next()
		}

		apiKey := strings.TrimSpace(os.Getenv("MANJU_API_KEY"))
		if apiKey == "" {
			// If not set, allow all (safety for initial setup)
			return c.Next()
		}

		clientKey := c.Get("X-API-Key")
		if clientKey == "" || clientKey != apiKey {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized: missing or invalid API Key",
			})
		}

		return c.Next()
	}
}
