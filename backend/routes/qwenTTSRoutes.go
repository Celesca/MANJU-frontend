package routes

import (
	"manju/backend/config/database"
	"manju/backend/controllers"
	"manju/backend/repository"

	"github.com/gofiber/fiber/v2"
)

// QwenTTSRoutes registers Qwen3-TTS related routes.
func QwenTTSRoutes(app fiber.Router) {
	repo := repository.NewProject(database.Database)
	ctrl := controllers.NewQwenTTSController(repo)

	// Talk endpoint on projects (workflow → Qwen TTS → audio stream)
	projects := app.Group("/projects")
	projects.Post("/:id/talk", ctrl.Talk)

	// Standalone Qwen TTS routes
	qwen := app.Group("/qwen-tts")
	qwen.Get("/health", ctrl.QwenTTSHealth)
	qwen.Post("/text-to-voice", ctrl.TextToVoice)
	qwen.Post("/tts-sentence", ctrl.TTSSentence)

	// Voice reference cache CRUD
	refs := qwen.Group("/voice-references")
	refs.Post("/upload", ctrl.UploadVoiceReference)
	refs.Get("/", ctrl.ListVoiceReferences)
	refs.Get("/:refId", ctrl.GetVoiceReference)
	refs.Put("/:refId", ctrl.UpdateVoiceReference)
	refs.Delete("/:refId", ctrl.DeleteVoiceReference)
}
