package services

import (
	"manju/backend/models/request"
	"manju/backend/repository"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func CreateVoice(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	var body request.CreateVoicePayload
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	if body.VoiceName == "" || body.VoiceURL == "" || body.UserID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "voice_name, voice_url and user_id are required"})
	}

	uid, err := uuid.Parse(body.UserID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_id"})
	}

	v := repository.Voice{
		VoiceName: body.VoiceName,
		VoiceURL:  body.VoiceURL,
		RefText:   body.RefText,
		UserID:    uid,
	}

	created, err := repo.Create(&v)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(http.StatusCreated).JSON(created)
}

func ListVoices(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	voices, err := repo.List()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(voices)
}

func ListVoicesByUser(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	userID := c.Params("user_id")
	voices, err := repo.ListByUser(userID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(voices)
}

func GetVoice(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	id := c.Params("id")
	v, err := repo.GetByID(id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if v == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
	}
	return c.JSON(v)
}

func DeleteVoice(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	id := c.Params("id")
	ok, err := repo.Delete(id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if !ok {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
	}
	return c.SendStatus(http.StatusNoContent)
}
