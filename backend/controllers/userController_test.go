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

// testDB creates a test database connection
func testDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "host=localhost user=postgres password=postgres dbname=manju_test port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("Skipping DB tests: cannot connect to test database: %v", err)
	}

	// Auto-migrate test tables
	if err := db.AutoMigrate(&repository.User{}, &repository.UserAPIKey{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Clean tables
	db.Exec("DELETE FROM user_api_keys")
	db.Exec("DELETE FROM users")

	return db
}

// ---------- UserController Tests ----------

func TestUserController_CreateUser(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)
	controller := NewUserController(userRepo)

	app := fiber.New()
	app.Post("/users", controller.CreateUser)

	body := map[string]string{
		"email": "controller-test@example.com",
		"name":  "Controller Test User",
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
}

func TestUserController_ListUsers(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)
	controller := NewUserController(userRepo)

	app := fiber.New()
	app.Get("/users", controller.ListUsers)

	req := httptest.NewRequest(http.MethodGet, "/users", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestUserController_GetUser(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)
	controller := NewUserController(userRepo)

	// Create a user first
	user := &repository.User{Email: "get-ctrl@test.com", Name: "Get User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Get("/users/:id", controller.GetUser)

	req := httptest.NewRequest(http.MethodGet, "/users/"+createdUser.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestUserController_UpdateUser(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)
	controller := NewUserController(userRepo)

	user := &repository.User{Email: "update-ctrl@test.com", Name: "Before", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Put("/users/:id", controller.UpdateUser)

	body := map[string]string{"name": "After Update"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/users/"+createdUser.ID.String(), bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestUserController_DeleteUser(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)
	controller := NewUserController(userRepo)

	user := &repository.User{Email: "delete-ctrl@test.com", Name: "Delete Me", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Delete("/users/:id", controller.DeleteUser)

	req := httptest.NewRequest(http.MethodDelete, "/users/"+createdUser.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected 204, got %d", resp.StatusCode)
	}
}

func TestUserController_GetUser_NotFound(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)
	controller := NewUserController(userRepo)

	app := fiber.New()
	app.Get("/users/:id", controller.GetUser)

	req := httptest.NewRequest(http.MethodGet, "/users/"+uuid.New().String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

func TestUserController_Instantiation(t *testing.T) {
	db := testDB(t)
	userRepo := repository.New(db)
	controller := NewUserController(userRepo)

	if controller == nil {
		t.Fatal("Expected controller to be instantiated")
	}
	if controller.repo == nil {
		t.Error("Expected controller.repo to be set")
	}
}
