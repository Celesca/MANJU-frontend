package services

import (
	"manju/backend/repository"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ListAPIKeys returns all API keys for a user (masked)
func ListAPIKeys(c *fiber.Ctx, repo *repository.UserAPIKeyRepository) error {
	userID := c.Params("id")

	keys, err := repo.ListByUserID(userID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Mask the keys before returning
	for i := range keys {
		decrypted, err := DecryptAPIKey(keys[i].EncryptedKey)
		if err == nil {
			keys[i].MaskedKey = MaskAPIKey(decrypted)
		} else {
			keys[i].MaskedKey = "****"
		}
	}

	return c.JSON(keys)
}

// AddAPIKey adds a new API key for a user
func AddAPIKey(c *fiber.Ctx, repo *repository.UserAPIKeyRepository) error {
	userID := c.Params("id")

	var body struct {
		Label    string `json:"label"`
		APIKey   string `json:"api_key"`
		Provider string `json:"provider"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	if body.APIKey == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "api_key is required"})
	}
	if body.Label == "" {
		body.Label = "Default Key"
	}
	if body.Provider == "" {
		body.Provider = "openai"
	}

	// Encrypt the API key
	encrypted, err := EncryptAPIKey(body.APIKey)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to encrypt key"})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid user id"})
	}

	key := &repository.UserAPIKey{
		UserID:       userUUID,
		Label:        body.Label,
		EncryptedKey: encrypted,
		Provider:     body.Provider,
	}

	// Check if this is the first key - make it default
	existing, _ := repo.ListByUserID(userID)
	if len(existing) == 0 {
		key.IsDefault = true
	}

	created, err := repo.Create(key)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Set masked key for response
	created.MaskedKey = MaskAPIKey(body.APIKey)

	return c.Status(http.StatusCreated).JSON(created)
}

// DeleteAPIKey removes an API key
func DeleteAPIKey(c *fiber.Ctx, repo *repository.UserAPIKeyRepository) error {
	userID := c.Params("id")
	keyID := c.Params("keyId")

	if err := repo.Delete(keyID, userID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(http.StatusNoContent)
}

// SetDefaultAPIKey sets a key as the default
func SetDefaultAPIKey(c *fiber.Ctx, repo *repository.UserAPIKeyRepository) error {
	userID := c.Params("id")
	keyID := c.Params("keyId")

	if err := repo.SetDefault(keyID, userID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "default key updated"})
}

// GetDecryptedAPIKey retrieves and decrypts a specific API key (internal use)
func GetDecryptedAPIKey(repo *repository.UserAPIKeyRepository, keyID string) (string, error) {
	key, err := repo.GetByID(keyID)
	if err != nil {
		return "", err
	}
	return DecryptAPIKey(key.EncryptedKey)
}
