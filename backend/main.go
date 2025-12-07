package main

import (
	"log"
	"manju/backend/config/database"
	"manju/backend/repository"
	"os"
	"strings"

	routes "manju/backend/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
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
		redirect = "http://localhost:8000/auth/callback/google"
	}

	database.Connect()
	app := fiber.New()

	// CORS: allow frontend origin and enable credentials (so cookies are sent)
	frontend := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if frontend == "" {
		frontend = "http://localhost:5173"
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     frontend,
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
	}))

	// Dev helper: disable auth checks and inject a developer user into context
	if strings.ToLower(strings.TrimSpace(os.Getenv("DISABLE_AUTH"))) == "true" {
		devID := strings.TrimSpace(os.Getenv("DEV_USER_ID"))
		log.Printf("DISABLE_AUTH=true — injecting dev user (DEV_USER_ID=%s)", devID)
		app.Use(func(c *fiber.Ctx) error {
			uid := devID
			if uid == "" {
				// try to pick an existing user or create a dev user
				userRepo := repository.New(database.Database)
				users, err := userRepo.List()
				if err == nil && len(users) > 0 {
					uid = users[0].ID.String()
				} else {
					newUser := &repository.User{Email: "dev@localhost", Name: "Dev", Status: repository.StatusActive}
					created, err := userRepo.Create(newUser)
					if err == nil {
						uid = created.ID.String()
					}
				}
			}
			if uid != "" {
				c.Locals("userID", uid)
			}
			return c.Next()
		})
	}

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
	routes.ProjectRoutes(api)

	log.Fatal(app.Listen(":8080"))
}
