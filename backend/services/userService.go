package services

import (
	"encoding/json"
	"manju/backend/models/request"
	"manju/backend/repository"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"gorm.io/datatypes"
)

func CreateUser(c *fiber.Ctx, repo *repository.UserRepository) error {
	var body request.CreateUserPayload
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	if body.Email == "" || body.Name == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "email and name are required"})
	}

	user := repository.User{
		Email: body.Email,
		Name:  body.Name,
		Status: func() repository.Status {
			if body.Status == "" {
				return repository.StatusActive
			}
			return body.Status
		}(),
	}

	if body.Info != nil {
		b, err := json.Marshal(body.Info)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid info"})
		}
		user.Info = datatypes.JSON(b)
	}

	created, err := repo.Create(&user)
	if err != nil {
		if err.Error() == "email_already_registered" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "email already registered"})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(http.StatusCreated).JSON(created)
}

func ListUsers(c *fiber.Ctx, repo *repository.UserRepository) error {
	users, err := repo.List()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(users)
}

func GetUser(c *fiber.Ctx, repo *repository.UserRepository) error {
	id := c.Params("id")
	user, err := repo.GetByID(id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if user == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
	}
	return c.JSON(user)
}

func UpdateUser(c *fiber.Ctx, repo *repository.UserRepository) error {
	id := c.Params("id")
	payload := make(map[string]interface{})
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	// convert Info to JSON if present
	if info, ok := payload["info"]; ok {
		b, err := json.Marshal(info)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid info"})
		}
		payload["info"] = datatypes.JSON(b)
	}

	updated, err := repo.Update(id, payload)
	if err != nil {
		if err.Error() == "email_already_registered" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "email already registered"})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if updated == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
	}
	return c.JSON(updated)
}

func DeleteUser(c *fiber.Ctx, repo *repository.UserRepository) error {
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

// SaveAPIKey encrypts and stores a user's API key
func SaveAPIKey(c *fiber.Ctx, repo *repository.UserRepository) error {
	id := c.Params("id")

	var body struct {
		APIKey string `json:"api_key"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	if body.APIKey == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "api_key is required"})
	}

	// Encrypt the API key
	encrypted, err := EncryptAPIKey(body.APIKey)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to encrypt key"})
	}

	// Update the user's encrypted API key
	_, err = repo.Update(id, map[string]interface{}{
		"encrypted_api_key": encrypted,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "API key saved successfully", "masked_key": MaskAPIKey(body.APIKey)})
}

// GetAPIKey returns a masked version of the user's API key
func GetAPIKey(c *fiber.Ctx, repo *repository.UserRepository) error {
	id := c.Params("id")

	user, err := repo.GetByID(id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if user == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
	}

	if user.EncryptedAPIKey == "" {
		return c.JSON(fiber.Map{"has_key": false, "masked_key": ""})
	}

	// Decrypt only to mask it
	decrypted, err := DecryptAPIKey(user.EncryptedAPIKey)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to decrypt key"})
	}

	return c.JSON(fiber.Map{"has_key": true, "masked_key": MaskAPIKey(decrypted)})
}
