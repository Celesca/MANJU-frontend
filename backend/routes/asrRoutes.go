package routes

import (
	"manju/backend/controllers"

	"github.com/gofiber/fiber/v2"
)

func ASRRoutes(app fiber.Router) {
	ctrl := controllers.NewASRController()

	router := app.Group("/asr")
	router.Post("/transcribe", ctrl.Transcribe)
}
