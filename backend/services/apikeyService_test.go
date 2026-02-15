package services

import (
	"bytes"
	"encoding/json"
	"io"
	"manju/backend/repository"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ---------- AddAPIKey ----------

func TestAddAPIKey_Success(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	userRepo := repository.New(db)

	// Create a user first
	user := &repository.User{Email: "apikey@test.com", Name: "API User", Status: repository.StatusActive}
	createdUser, err := userRepo.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	app := fiber.New()
	app.Post("/users/:id/api-keys", func(c *fiber.Ctx) error {
		return AddAPIKey(c, apiKeyRepo)
	})

	body := map[string]string{
		"label":    "My OpenAI Key",
		"api_key":  "sk-test12345678901234567890",
		"provider": "openai",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/users/"+createdUser.ID.String()+"/api-keys", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var created repository.UserAPIKey
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &created)

	if created.Label != "My OpenAI Key" {
		t.Errorf("Expected label 'My OpenAI Key', got %q", created.Label)
	}
	if created.Provider != "openai" {
		t.Errorf("Expected provider 'openai', got %q", created.Provider)
	}
	if created.MaskedKey == "" {
		t.Error("Expected masked_key to be set")
	}
}

func TestAddAPIKey_MissingAPIKey(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)

	app := fiber.New()
	app.Post("/users/:id/api-keys", func(c *fiber.Ctx) error {
		return AddAPIKey(c, apiKeyRepo)
	})

	body := map[string]string{"label": "Test"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/users/"+uuid.New().String()+"/api-keys", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", resp.StatusCode)
	}
}

func TestAddAPIKey_DefaultLabel(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "default-label@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Post("/users/:id/api-keys", func(c *fiber.Ctx) error {
		return AddAPIKey(c, apiKeyRepo)
	})

	body := map[string]string{"api_key": "sk-test123"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/users/"+createdUser.ID.String()+"/api-keys", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var created repository.UserAPIKey
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &created)

	if created.Label != "Default Key" {
		t.Errorf("Expected default label 'Default Key', got %q", created.Label)
	}
	if created.Provider != "openai" {
		t.Errorf("Expected default provider 'openai', got %q", created.Provider)
	}
}

func TestAddAPIKey_FirstKeyIsDefault(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "first-default@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Post("/users/:id/api-keys", func(c *fiber.Ctx) error {
		return AddAPIKey(c, apiKeyRepo)
	})

	body := map[string]string{"api_key": "sk-first"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/users/"+createdUser.ID.String()+"/api-keys", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	var created repository.UserAPIKey
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &created)

	if !created.IsDefault {
		t.Error("Expected first key to be set as default")
	}
}

// ---------- ListAPIKeys ----------

func TestListAPIKeys_Empty(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "list-empty@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Get("/users/:id/api-keys", func(c *fiber.Ctx) error {
		return ListAPIKeys(c, apiKeyRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/users/"+createdUser.ID.String()+"/api-keys", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}

	var keys []repository.UserAPIKey
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &keys)
	if len(keys) != 0 {
		t.Errorf("Expected 0 keys, got %d", len(keys))
	}
}

// ---------- DeleteAPIKey ----------

func TestDeleteAPIKey_Success(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "delete-key@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	encrypted, _ := EncryptAPIKey("sk-todelete")
	key := &repository.UserAPIKey{
		UserID:       createdUser.ID,
		Label:        "To Delete",
		EncryptedKey: encrypted,
		Provider:     "openai",
	}
	createdKey, _ := apiKeyRepo.Create(key)

	app := fiber.New()
	app.Delete("/users/:id/api-keys/:keyId", func(c *fiber.Ctx) error {
		return DeleteAPIKey(c, apiKeyRepo)
	})

	req := httptest.NewRequest(http.MethodDelete, "/users/"+createdUser.ID.String()+"/api-keys/"+createdKey.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected 204, got %d", resp.StatusCode)
	}
}

// ---------- SetDefaultAPIKey ----------

func TestSetDefaultAPIKey_Success(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "set-default@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	encrypted1, _ := EncryptAPIKey("sk-key1")
	key1 := &repository.UserAPIKey{
		UserID:       createdUser.ID,
		Label:        "Key 1",
		EncryptedKey: encrypted1,
		Provider:     "openai",
		IsDefault:    true,
	}
	apiKeyRepo.Create(key1)

	encrypted2, _ := EncryptAPIKey("sk-key2")
	key2 := &repository.UserAPIKey{
		UserID:       createdUser.ID,
		Label:        "Key 2",
		EncryptedKey: encrypted2,
		Provider:     "openai",
	}
	createdKey2, _ := apiKeyRepo.Create(key2)

	app := fiber.New()
	app.Put("/users/:id/api-keys/:keyId/default", func(c *fiber.Ctx) error {
		return SetDefaultAPIKey(c, apiKeyRepo)
	})

	req := httptest.NewRequest(http.MethodPut, "/users/"+createdUser.ID.String()+"/api-keys/"+createdKey2.ID.String()+"/default", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	// Verify key2 is now default
	defaultKey, _ := apiKeyRepo.GetDefaultByUserID(createdUser.ID.String())
	if defaultKey.ID != createdKey2.ID {
		t.Error("Expected key2 to be the new default")
	}
}

// ---------- GetDecryptedAPIKey ----------

func TestGetDecryptedAPIKey_Success(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "decrypt-key@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	plainKey := "sk-mysecretkey123"
	encrypted, _ := EncryptAPIKey(plainKey)
	key := &repository.UserAPIKey{
		UserID:       createdUser.ID,
		Label:        "Test Key",
		EncryptedKey: encrypted,
		Provider:     "openai",
	}
	createdKey, _ := apiKeyRepo.Create(key)

	decrypted, err := GetDecryptedAPIKey(apiKeyRepo, createdKey.ID.String())
	if err != nil {
		t.Fatalf("GetDecryptedAPIKey failed: %v", err)
	}
	if decrypted != plainKey {
		t.Errorf("Expected %q, got %q", plainKey, decrypted)
	}
}

func TestGetDecryptedAPIKey_NotFound(t *testing.T) {
	db := testDB(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)

	_, err := GetDecryptedAPIKey(apiKeyRepo, uuid.New().String())
	if err == nil {
		t.Error("Expected error for non-existent key, got nil")
	}
}
