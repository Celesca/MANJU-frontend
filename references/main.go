package main

import (
	"log"
	"manju/backend/config/database"
	"os"
	"strings"

	routes "manju/backend/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/swagger"
	"github.com/joho/godotenv"
	"github.com/stretchr/gomniauth"
	"github.com/stretchr/gomniauth/providers/google"
	"github.com/stretchr/signature"
)

func main() {
	// Load .env (if present) so env vars from the project file are available during local development
	_ = godotenv.Load()

	// ensure redirect URI is consistent and trimmed
	redirect := strings.TrimSpace(os.Getenv("REDIRECT_URI"))
	if redirect == "" {
		redirect = "http://localhost:8080/auth/callback/google"
	}

	database.Connect()
	app := fiber.New()

	// Authentication
	gomniauth.SetSecurityKey(signature.RandomKey(64))
	gomniauth.WithProviders(
		google.New(strings.TrimSpace(os.Getenv("CLIENT_ID")), strings.TrimSpace(os.Getenv("CLIENT_SECRET")), redirect),
	)

	routes.AuthRoutes(app)

	api := app.Group("/api")
	api.Get("/docs/*", swagger.HandlerDefault) // default swagger UI
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	routes.UserRoutes(api)
	routes.VoiceRoutes(api)

	log.Fatal(app.Listen(":8080"))
}
