package routes

import (
	authpkg "manju/backend/auth"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func AuthRoutes(app fiber.Router) {
	router := app.Group("/auth")

	// Recover from panics in auth handlers and log requests for debugging
	router.Use(recover.New())
	router.Use(logger.New())

	router.Get("/login/google", authpkg.Login)
	router.Get("/callback/google", authpkg.Callback)
	router.Get("/me", authpkg.Me)
	router.Get("/logout", authpkg.Logout)
}
