package controllers

import (
	"bytes"
	"encoding/json"
	"io"
	"manju/backend/repository"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDBAPIKey creates a test database connection for API key tests
func testDBAPIKey(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "host=localhost user=postgres password=postgres dbname=manju_test port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("Skipping DB tests: cannot connect to test database: %v", err)
	}

	if err := db.AutoMigrate(&repository.User{}, &repository.UserAPIKey{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	db.Exec("DELETE FROM user_api_keys")
	db.Exec("DELETE FROM users")

	return db
}

// ---------- APIKeyController Tests ----------

func TestAPIKeyController_ListAPIKeys(t *testing.T) {
	db := testDBAPIKey(t)
	// Note: NewAPIKeyController creates its own repo from database.Database
	// For testing, we'll test the methods directly via the service layer
	userRepo := repository.New(db)

	user := &repository.User{Email: "apikey-ctrl@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	controller := &APIKeyController{repo: apiKeyRepo}

	app := fiber.New()
	app.Get("/users/:id/api-keys", controller.ListAPIKeys)

	req := httptest.NewRequest(http.MethodGet, "/users/"+createdUser.ID.String()+"/api-keys", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestAPIKeyController_AddAPIKey(t *testing.T) {
	db := testDBAPIKey(t)
	userRepo := repository.New(db)

	user := &repository.User{Email: "add-apikey@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	controller := &APIKeyController{repo: apiKeyRepo}

	app := fiber.New()
	app.Post("/users/:id/api-keys", controller.AddAPIKey)

	body := map[string]string{
		"label":    "Test Key",
		"api_key":  "sk-test123456789",
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
}

func TestAPIKeyController_DeleteAPIKey(t *testing.T) {
	db := testDBAPIKey(t)
	userRepo := repository.New(db)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)

	user := &repository.User{Email: "del-apikey@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	key := &repository.UserAPIKey{
		UserID:       createdUser.ID,
		Label:        "Delete Me",
		EncryptedKey: "encrypted",
		Provider:     "openai",
	}
	createdKey, _ := apiKeyRepo.Create(key)

	controller := &APIKeyController{repo: apiKeyRepo}

	app := fiber.New()
	app.Delete("/users/:id/api-keys/:keyId", controller.DeleteAPIKey)

	req := httptest.NewRequest(http.MethodDelete, "/users/"+createdUser.ID.String()+"/api-keys/"+createdKey.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected 204, got %d", resp.StatusCode)
	}
}

func TestAPIKeyController_SetDefaultAPIKey(t *testing.T) {
	db := testDBAPIKey(t)
	userRepo := repository.New(db)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)

	user := &repository.User{Email: "default-apikey@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	key := &repository.UserAPIKey{
		UserID:       createdUser.ID,
		Label:        "Make Default",
		EncryptedKey: "encrypted",
		Provider:     "openai",
	}
	createdKey, _ := apiKeyRepo.Create(key)

	controller := &APIKeyController{repo: apiKeyRepo}

	app := fiber.New()
	app.Put("/users/:id/api-keys/:keyId/default", controller.SetDefaultAPIKey)

	req := httptest.NewRequest(http.MethodPut, "/users/"+createdUser.ID.String()+"/api-keys/"+createdKey.ID.String()+"/default", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestAPIKeyController_Instantiation(t *testing.T) {
	db := testDBAPIKey(t)
	apiKeyRepo := repository.NewUserAPIKeyRepository(db)
	controller := &APIKeyController{repo: apiKeyRepo}

	if controller == nil {
		t.Fatal("Expected controller to be instantiated")
	}
	if controller.repo == nil {
		t.Error("Expected controller.repo to be set")
	}
}
