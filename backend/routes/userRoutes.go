package routes

import (
	"manju/backend/config/database"
	"manju/backend/controllers"
	"manju/backend/repository"

	"github.com/gofiber/fiber/v2"
)

func UserRoutes(app fiber.Router) {
	repo := repository.New(database.Database)
	ctrl := controllers.NewUserController(repo)

	router := app.Group("/users")
	router.Post("/", ctrl.CreateUser)
	router.Get("/", ctrl.ListUsers)
	router.Get("/:id", ctrl.GetUser)
	router.Put("/:id", ctrl.UpdateUser)
	router.Delete("/:id", ctrl.DeleteUser)

	// Single API Key management (legacy)
	router.Put("/:id/api-key", ctrl.SaveAPIKey)
	router.Get("/:id/api-key", ctrl.GetAPIKey)

	// Multiple API Keys management
	apiKeyCtrl := controllers.NewAPIKeyController()
	router.Get("/:id/api-keys", apiKeyCtrl.ListAPIKeys)
	router.Post("/:id/api-keys", apiKeyCtrl.AddAPIKey)
	router.Delete("/:id/api-keys/:keyId", apiKeyCtrl.DeleteAPIKey)
	router.Put("/:id/api-keys/:keyId/default", apiKeyCtrl.SetDefaultAPIKey)
}
