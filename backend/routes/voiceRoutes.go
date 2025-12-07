package routes

import (
	"manju/backend/config/database"
	"manju/backend/controllers"
	"manju/backend/repository"

	"github.com/gofiber/fiber/v2"
)

func VoiceRoutes(app fiber.Router) {
	repo := repository.NewVoice(database.Database)
	ctrl := controllers.NewVoiceController(repo)

	router := app.Group("/voices")
	router.Post("/", ctrl.CreateVoice)
	router.Get("/", ctrl.ListVoices)
	router.Get("/user/:user_id", ctrl.ListVoicesByUser)
	router.Get("/:id", ctrl.GetVoice)
	router.Delete("/:id", ctrl.DeleteVoice)
}
