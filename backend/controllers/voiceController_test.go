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
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDBVoice creates a test database connection for voice tests
func testDBVoice(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "host=localhost user=postgres password=postgres dbname=manju_test port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("Skipping DB tests: cannot connect to test database: %v", err)
	}

	if err := db.AutoMigrate(&repository.User{}, &repository.Voice{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	db.Exec("DELETE FROM voices")
	db.Exec("DELETE FROM users")

	return db
}

// ---------- VoiceController Tests ----------

func TestVoiceController_CreateVoice(t *testing.T) {
	db := testDBVoice(t)
	voiceRepo := repository.NewVoice(db)
	userRepo := repository.New(db)
	controller := NewVoiceController(voiceRepo)

	user := &repository.User{Email: "voice-ctrl@test.com", Name: "Voice User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Post("/voices", controller.CreateVoice)

	body := map[string]string{
		"voice_name": "Controller Voice",
		"voice_url":  "https://example.com/voice.wav",
		"user_id":    createdUser.ID.String(),
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/voices", bytes.NewReader(jsonBody))
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

func TestVoiceController_ListVoices(t *testing.T) {
	db := testDBVoice(t)
	voiceRepo := repository.NewVoice(db)
	controller := NewVoiceController(voiceRepo)

	app := fiber.New()
	app.Get("/voices", controller.ListVoices)

	req := httptest.NewRequest(http.MethodGet, "/voices", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestVoiceController_GetVoice(t *testing.T) {
	db := testDBVoice(t)
	voiceRepo := repository.NewVoice(db)
	userRepo := repository.New(db)
	controller := NewVoiceController(voiceRepo)

	user := &repository.User{Email: "get-voice@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	voice := &repository.Voice{
		VoiceName: "Test Voice",
		VoiceURL:  "https://example.com/test.wav",
		UserID:    createdUser.ID,
	}
	createdVoice, _ := voiceRepo.Create(voice)

	app := fiber.New()
	app.Get("/voices/:id", controller.GetVoice)

	req := httptest.NewRequest(http.MethodGet, "/voices/"+createdVoice.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestVoiceController_ListVoicesByUser(t *testing.T) {
	db := testDBVoice(t)
	voiceRepo := repository.NewVoice(db)
	userRepo := repository.New(db)
	controller := NewVoiceController(voiceRepo)

	user := &repository.User{Email: "list-voices@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Get("/users/:userId/voices", controller.ListVoicesByUser)

	req := httptest.NewRequest(http.MethodGet, "/users/"+createdUser.ID.String()+"/voices", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestVoiceController_DeleteVoice(t *testing.T) {
	db := testDBVoice(t)
	voiceRepo := repository.NewVoice(db)
	userRepo := repository.New(db)
	controller := NewVoiceController(voiceRepo)

	user := &repository.User{Email: "del-voice@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	voice := &repository.Voice{
		VoiceName: "Delete Me",
		VoiceURL:  "https://example.com/delete.wav",
		UserID:    createdUser.ID,
	}
	createdVoice, _ := voiceRepo.Create(voice)

	app := fiber.New()
	app.Delete("/voices/:id", controller.DeleteVoice)

	req := httptest.NewRequest(http.MethodDelete, "/voices/"+createdVoice.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected 204, got %d", resp.StatusCode)
	}
}

func TestVoiceController_GetVoice_NotFound(t *testing.T) {
	db := testDBVoice(t)
	voiceRepo := repository.NewVoice(db)
	controller := NewVoiceController(voiceRepo)

	app := fiber.New()
	app.Get("/voices/:id", controller.GetVoice)

	req := httptest.NewRequest(http.MethodGet, "/voices/"+uuid.New().String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

func TestVoiceController_Instantiation(t *testing.T) {
	db := testDBVoice(t)
	voiceRepo := repository.NewVoice(db)
	controller := NewVoiceController(voiceRepo)

	if controller == nil {
		t.Fatal("Expected controller to be instantiated")
	}
	if controller.repo == nil {
		t.Error("Expected controller.repo to be set")
	}
}
