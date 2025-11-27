package main

import (
	"log"
	"manju/backend/config/database"
	"os"

	routes "manju/backend/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/swagger"
	"github.com/stretchr/gomniauth"
	"github.com/stretchr/gomniauth/providers/google"
	"github.com/stretchr/signature"
)

func main() {
	database.Connect()
	app := fiber.New()

	// Authentication
	gomniauth.SetSecurityKey(signature.RandomKey(64))
	gomniauth.WithProviders(
		google.New(os.Getenv("CLIENT_ID"), os.Getenv("CLIENT_SECRET"), "http://localhost:8080/auth/callback/google"),
	)

	api := app.Group("/api")
	api.Get("/docs/*", swagger.HandlerDefault) // default swagger UI
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	routes.UserRoutes(api)
	routes.VoiceRoutes(api)
	routes.AuthRoutes(api)

	log.Fatal(app.Listen(":8080"))
}
