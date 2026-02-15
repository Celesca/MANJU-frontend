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

// ---------- CreateVoice ----------

func TestCreateVoice_Success(t *testing.T) {
	db := testDB(t)
	voiceRepo := repository.NewVoice(db)
	userRepo := repository.New(db)

	// Create a user first
	user := &repository.User{Email: "voice@test.com", Name: "Voice Tester", Status: repository.StatusActive}
	user, err := userRepo.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	app := fiber.New()
	app.Post("/voices", func(c *fiber.Ctx) error {
		return CreateVoice(c, voiceRepo)
	})

	body := map[string]string{
		"voice_name": "Test Voice",
		"voice_url":  "https://example.com/voice.wav",
		"ref_text":   "Hello world",
		"gender":     "female",
		"user_id":    user.ID.String(),
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

func TestCreateVoice_MissingFields(t *testing.T) {
	db := testDB(t)
	voiceRepo := repository.NewVoice(db)

	app := fiber.New()
	app.Post("/voices", func(c *fiber.Ctx) error {
		return CreateVoice(c, voiceRepo)
	})

	// Missing voice_name
	body := map[string]string{
		"voice_url": "https://example.com/voice.wav",
		"user_id":   uuid.New().String(),
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/voices", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", resp.StatusCode)
	}
}

func TestCreateVoice_InvalidUserID(t *testing.T) {
	db := testDB(t)
	voiceRepo := repository.NewVoice(db)

	app := fiber.New()
	app.Post("/voices", func(c *fiber.Ctx) error {
		return CreateVoice(c, voiceRepo)
	})

	body := map[string]string{
		"voice_name": "Test Voice",
		"voice_url":  "https://example.com/voice.wav",
		"user_id":    "not-a-uuid",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/voices", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", resp.StatusCode)
	}
}

// ---------- ListVoices ----------

func TestListVoices_Empty(t *testing.T) {
	db := testDB(t)
	voiceRepo := repository.NewVoice(db)

	app := fiber.New()
	app.Get("/voices", func(c *fiber.Ctx) error {
		return ListVoices(c, voiceRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/voices", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}

	var voices []repository.Voice
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &voices); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if len(voices) != 0 {
		t.Errorf("Expected 0 voices, got %d", len(voices))
	}
}

// ---------- GetVoice ----------

func TestGetVoice_NotFound(t *testing.T) {
	db := testDB(t)
	voiceRepo := repository.NewVoice(db)

	app := fiber.New()
	app.Get("/voices/:id", func(c *fiber.Ctx) error {
		return GetVoice(c, voiceRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/voices/"+uuid.New().String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

// ---------- DeleteVoice ----------

func TestDeleteVoice_NotFound(t *testing.T) {
	db := testDB(t)
	voiceRepo := repository.NewVoice(db)

	app := fiber.New()
	app.Delete("/voices/:id", func(c *fiber.Ctx) error {
		return DeleteVoice(c, voiceRepo)
	})

	req := httptest.NewRequest(http.MethodDelete, "/voices/"+uuid.New().String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

// ---------- sanitizeFilename ----------

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"My Voice", "My_Voice"},
		{"test@#$%file", "test____file"},
		{"normal_name", "normal_name"},
		{"hello-world", "hello-world"},
		{"thai ชื่อ", "thai_____"},
	}

	for _, tc := range tests {
		got := sanitizeFilename(tc.input)
		if got != tc.expected {
			t.Errorf("sanitizeFilename(%q) = %q, want %q", tc.input, got, tc.expected)
		}
	}
}
