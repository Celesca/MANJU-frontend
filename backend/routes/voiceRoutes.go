package routes

import (
	"manju/backend/config/database"
	"manju/backend/controllers"
	"manju/backend/repository"
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

func VoiceRoutes(app fiber.Router) {
	repo := repository.NewVoice(database.Database)
	ctrl := controllers.NewVoiceController(repo)

	router := app.Group("/voices")

	// File upload and serving routes (must be before :id routes)
	router.Post("/upload", services.UploadVoiceFile)
	router.Get("/files/:user_id/:filename", services.ServeVoiceFile)

	// Voice CRUD routes
	router.Post("/", ctrl.CreateVoice)
	router.Get("/", ctrl.ListVoices)
	router.Get("/user/:user_id", ctrl.ListVoicesByUser)
	router.Post("/:id/clone", ctrl.CloneVoice)
	router.Get("/:id", ctrl.GetVoice)
	router.Delete("/:id", ctrl.DeleteVoice)
}
