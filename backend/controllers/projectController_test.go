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
	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDBProject creates a test database connection for project tests
func testDBProject(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := "host=localhost user=postgres password=postgres dbname=manju_test port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("Skipping DB tests: cannot connect to test database: %v", err)
	}

	if err := db.AutoMigrate(&repository.User{}, &repository.Project{}); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	db.Exec("DELETE FROM projects")
	db.Exec("DELETE FROM users")

	return db
}

// ---------- ProjectController Tests ----------

func TestProjectController_CreateProject(t *testing.T) {
	db := testDBProject(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewProjectController(projectRepo)

	user := &repository.User{Email: "proj-ctrl@test.com", Name: "Proj User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Post("/projects", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return controller.CreateProject(c)
	})

	body := map[string]interface{}{
		"name":        "Controller Test Project",
		"description": "Testing",
		"nodes":       []interface{}{},
		"connections": []interface{}{},
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/projects", bytes.NewReader(jsonBody))
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

func TestProjectController_ListProjects(t *testing.T) {
	db := testDBProject(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewProjectController(projectRepo)

	user := &repository.User{Email: "list-proj@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	app := fiber.New()
	app.Get("/projects", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return controller.ListProjects(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestProjectController_GetProject(t *testing.T) {
	db := testDBProject(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewProjectController(projectRepo)

	user := &repository.User{Email: "get-proj@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "Get Me",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Get("/projects/:id", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return controller.GetProject(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects/"+createdProject.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestProjectController_UpdateProject(t *testing.T) {
	db := testDBProject(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewProjectController(projectRepo)

	user := &repository.User{Email: "upd-proj@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "Before",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Put("/projects/:id", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return controller.UpdateProject(c)
	})

	body := map[string]string{"name": "After"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/projects/"+createdProject.ID.String(), bytes.NewReader(jsonBody))
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

func TestProjectController_DeleteProject(t *testing.T) {
	db := testDBProject(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewProjectController(projectRepo)

	user := &repository.User{Email: "del-proj@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "Delete Me",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Delete("/projects/:id", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return controller.DeleteProject(c)
	})

	req := httptest.NewRequest(http.MethodDelete, "/projects/"+createdProject.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestProjectController_Instantiation(t *testing.T) {
	db := testDBProject(t)
	projectRepo := repository.NewProject(db)
	controller := NewProjectController(projectRepo)

	if controller == nil {
		t.Fatal("Expected controller to be instantiated")
	}
	if controller.repo == nil {
		t.Error("Expected controller.repo to be set")
	}
}
