package controllers

import (
	"manju/backend/repository"
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

type VoiceController struct {
	repo *repository.VoiceRepository
}

func NewVoiceController(repo *repository.VoiceRepository) *VoiceController {
	return &VoiceController{repo: repo}
}

func (vc *VoiceController) CreateVoice(c *fiber.Ctx) error {
	return services.CreateVoice(c, vc.repo)
}

func (vc *VoiceController) ListVoices(c *fiber.Ctx) error {
	return services.ListVoices(c, vc.repo)
}

func (vc *VoiceController) ListVoicesByUser(c *fiber.Ctx) error {
	return services.ListVoicesByUser(c, vc.repo)
}

func (vc *VoiceController) GetVoice(c *fiber.Ctx) error {
	return services.GetVoice(c, vc.repo)
}

func (vc *VoiceController) DeleteVoice(c *fiber.Ctx) error {
	return services.DeleteVoice(c, vc.repo)
}
