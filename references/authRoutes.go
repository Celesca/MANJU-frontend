package routes

import (
	authpkg "manju/backend/auth"

	"github.com/gofiber/fiber/v2"
)

func AuthRoutes(app fiber.Router) {
	router := app.Group("/auth")
	router.Get("/login/google", authpkg.Login)
	router.Get("/callback/google", authpkg.Callback)
}
