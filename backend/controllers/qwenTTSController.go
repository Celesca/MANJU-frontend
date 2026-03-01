package controllers

import (
	"manju/backend/repository"
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

// QwenTTSController handles Qwen3-TTS related HTTP requests.
type QwenTTSController struct {
	repo *repository.ProjectRepository
}

// NewQwenTTSController creates a new QwenTTSController.
func NewQwenTTSController(repo *repository.ProjectRepository) *QwenTTSController {
	return &QwenTTSController{repo: repo}
}

// Talk handles POST /projects/:id/talk
func (ctrl *QwenTTSController) Talk(c *fiber.Ctx) error {
	return services.Talk(c, ctrl.repo)
}

// TextToVoice handles POST /qwen-tts/text-to-voice
func (ctrl *QwenTTSController) TextToVoice(c *fiber.Ctx) error {
	return services.TextToVoice(c)
}

// UploadVoiceReference handles POST /qwen-tts/voice-references/upload
func (ctrl *QwenTTSController) UploadVoiceReference(c *fiber.Ctx) error {
	return services.UploadVoiceReference(c)
}

// ListVoiceReferences handles GET /qwen-tts/voice-references
func (ctrl *QwenTTSController) ListVoiceReferences(c *fiber.Ctx) error {
	return services.ListVoiceReferences(c)
}

// GetVoiceReference handles GET /qwen-tts/voice-references/:refId
func (ctrl *QwenTTSController) GetVoiceReference(c *fiber.Ctx) error {
	return services.GetVoiceReference(c)
}

// UpdateVoiceReference handles PUT /qwen-tts/voice-references/:refId
func (ctrl *QwenTTSController) UpdateVoiceReference(c *fiber.Ctx) error {
	return services.UpdateVoiceReference(c)
}

// DeleteVoiceReference handles DELETE /qwen-tts/voice-references/:refId
func (ctrl *QwenTTSController) DeleteVoiceReference(c *fiber.Ctx) error {
	return services.DeleteVoiceReference(c)
}

// QwenTTSHealth handles GET /qwen-tts/health
func (ctrl *QwenTTSController) QwenTTSHealth(c *fiber.Ctx) error {
	return services.QwenTTSHealth(c)
}
