package controllers

import (
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

// ASRController handles ASR-related HTTP requests
type ASRController struct{}

// NewASRController creates a new ASRController
func NewASRController() *ASRController {
	return &ASRController{}
}

// Transcribe handles POST /asr/transcribe
func (ctrl *ASRController) Transcribe(c *fiber.Ctx) error {
	return services.TranscribeASR(c)
}
