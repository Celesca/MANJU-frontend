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

// ---------- CreateUser ----------

func TestCreateUser_Success(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	app := fiber.New()
	app.Post("/users", func(c *fiber.Ctx) error {
		return CreateUser(c, userRepo)
	})

	body := map[string]string{
		"email": "test@example.com",
		"name":  "Test User",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/users", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var user repository.User
	respBody, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(respBody, &user); err != nil {
		t.Fatalf("Failed to unmarshal user: %v", err)
	}
	if user.Email != "test@example.com" {
		t.Errorf("Expected email 'test@example.com', got %q", user.Email)
	}
	if user.Name != "Test User" {
		t.Errorf("Expected name 'Test User', got %q", user.Name)
	}
	if user.Status != repository.StatusActive {
		t.Errorf("Expected status 'active', got %q", user.Status)
	}
}

func TestCreateUser_MissingEmail(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	app := fiber.New()
	app.Post("/users", func(c *fiber.Ctx) error {
		return CreateUser(c, userRepo)
	})

	body := map[string]string{"name": "Test User"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/users", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", resp.StatusCode)
	}
}

func TestCreateUser_DuplicateEmail(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	// Create first user
	user := &repository.User{Email: "dup@test.com", Name: "First", Status: repository.StatusActive}
	if _, err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create first user: %v", err)
	}

	app := fiber.New()
	app.Post("/users", func(c *fiber.Ctx) error {
		return CreateUser(c, userRepo)
	})

	body := map[string]string{"email": "dup@test.com", "name": "Second"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/users", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected 400 for duplicate email, got %d", resp.StatusCode)
	}
}

// ---------- ListUsers ----------

func TestListUsers_Empty(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	app := fiber.New()
	app.Get("/users", func(c *fiber.Ctx) error {
		return ListUsers(c, userRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/users", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}

	var users []repository.User
	respBody, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(respBody, &users); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}
	if len(users) != 0 {
		t.Errorf("Expected 0 users, got %d", len(users))
	}
}

// ---------- GetUser ----------

func TestGetUser_Success(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	user := &repository.User{Email: "get@test.com", Name: "Get User", Status: repository.StatusActive}
	created, err := userRepo.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	app := fiber.New()
	app.Get("/users/:id", func(c *fiber.Ctx) error {
		return GetUser(c, userRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/users/"+created.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestGetUser_NotFound(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	app := fiber.New()
	app.Get("/users/:id", func(c *fiber.Ctx) error {
		return GetUser(c, userRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/users/"+uuid.New().String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

// ---------- UpdateUser ----------

func TestUpdateUser_Success(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	user := &repository.User{Email: "update@test.com", Name: "Before", Status: repository.StatusActive}
	created, err := userRepo.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	app := fiber.New()
	app.Put("/users/:id", func(c *fiber.Ctx) error {
		return UpdateUser(c, userRepo)
	})

	body := map[string]string{"name": "After"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/users/"+created.ID.String(), bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var updated repository.User
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &updated)
	if updated.Name != "After" {
		t.Errorf("Expected name 'After', got %q", updated.Name)
	}
}

// ---------- DeleteUser ----------

func TestDeleteUser_Success(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	user := &repository.User{Email: "delete@test.com", Name: "Delete Me", Status: repository.StatusActive}
	created, err := userRepo.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	app := fiber.New()
	app.Delete("/users/:id", func(c *fiber.Ctx) error {
		return DeleteUser(c, userRepo)
	})

	req := httptest.NewRequest(http.MethodDelete, "/users/"+created.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected 204, got %d", resp.StatusCode)
	}
}

func TestDeleteUser_NotFound(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)

	app := fiber.New()
	app.Delete("/users/:id", func(c *fiber.Ctx) error {
		return DeleteUser(c, userRepo)
	})

	req := httptest.NewRequest(http.MethodDelete, "/users/"+uuid.New().String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}
