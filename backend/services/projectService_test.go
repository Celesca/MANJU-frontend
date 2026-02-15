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
	"gorm.io/datatypes"
)

// ---------- CreateProject ----------

func TestCreateProject_Success(t *testing.T) {
	db := testDB(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "proj@test.com", Name: "Project User", Status: repository.StatusActive}
	created, err := userRepo.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	app := fiber.New()
	app.Post("/projects", func(c *fiber.Ctx) error {
		c.Locals("userID", created.ID.String())
		return CreateProject(c, projectRepo)
	})

	body := map[string]interface{}{
		"name":        "Test Project",
		"description": "A test project",
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

func TestCreateProject_Unauthorized(t *testing.T) {
	db := testDB(t)
	projectRepo := repository.NewProject(db)

	app := fiber.New()
	app.Post("/projects", func(c *fiber.Ctx) error {
		// No userID in context
		return CreateProject(c, projectRepo)
	})

	body := map[string]string{"name": "Test"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/projects", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", resp.StatusCode)
	}
}

func TestCreateProject_MissingName(t *testing.T) {
	db := testDB(t)
	projectRepo := repository.NewProject(db)

	app := fiber.New()
	app.Post("/projects", func(c *fiber.Ctx) error {
		c.Locals("userID", uuid.New().String())
		return CreateProject(c, projectRepo)
	})

	body := map[string]string{"description": "No name"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/projects", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", resp.StatusCode)
	}
}

// ---------- ListProjects ----------

func TestListProjects_WithUserID(t *testing.T) {
	db := testDB(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "list@test.com", Name: "List User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	// Create a project
	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "Listed Project",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	projectRepo.Create(project)

	app := fiber.New()
	app.Get("/projects", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return ListProjects(c, projectRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}

	var projects []repository.Project
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &projects)
	if len(projects) != 1 {
		t.Errorf("Expected 1 project, got %d", len(projects))
	}
}

// ---------- GetProject ----------

func TestGetProject_Forbidden(t *testing.T) {
	db := testDB(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)

	owner := &repository.User{Email: "owner@test.com", Name: "Owner", Status: repository.StatusActive}
	ownerCreated, _ := userRepo.Create(owner)

	project := &repository.Project{
		UserID:      ownerCreated.ID,
		Name:        "Private Project",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Get("/projects/:id", func(c *fiber.Ctx) error {
		// Different user trying to access
		c.Locals("userID", uuid.New().String())
		return GetProject(c, projectRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects/"+createdProject.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("Expected 403, got %d", resp.StatusCode)
	}
}

func TestGetProject_NotFound(t *testing.T) {
	db := testDB(t)
	projectRepo := repository.NewProject(db)

	app := fiber.New()
	app.Get("/projects/:id", func(c *fiber.Ctx) error {
		c.Locals("userID", uuid.New().String())
		return GetProject(c, projectRepo)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects/"+uuid.New().String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

// ---------- DeleteProject ----------

func TestDeleteProject_Success(t *testing.T) {
	db := testDB(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)

	user := &repository.User{Email: "del-proj@test.com", Name: "Del User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "To Delete",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Delete("/projects/:id", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return DeleteProject(c, projectRepo)
	})

	req := httptest.NewRequest(http.MethodDelete, "/projects/"+createdProject.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestDeleteProject_Forbidden(t *testing.T) {
	db := testDB(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)

	owner := &repository.User{Email: "owner-del@test.com", Name: "Owner", Status: repository.StatusActive}
	ownerCreated, _ := userRepo.Create(owner)

	project := &repository.Project{
		UserID:      ownerCreated.ID,
		Name:        "Not Yours",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Delete("/projects/:id", func(c *fiber.Ctx) error {
		c.Locals("userID", uuid.New().String()) // different user
		return DeleteProject(c, projectRepo)
	})

	req := httptest.NewRequest(http.MethodDelete, "/projects/"+createdProject.ID.String(), nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("Expected 403, got %d", resp.StatusCode)
	}
}
