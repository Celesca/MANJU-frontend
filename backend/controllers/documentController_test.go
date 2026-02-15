package controllers

import (
	"manju/backend/repository"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDBDocument creates a test database connection for document tests
func testDBDocument(t *testing.T) *gorm.DB {
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

// ---------- DocumentController Tests ----------

func TestDocumentController_ListDocuments(t *testing.T) {
	db := testDBDocument(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewDocumentController(projectRepo)

	user := &repository.User{Email: "doc-ctrl@test.com", Name: "Doc User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "Doc Project",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Get("/projects/:id/documents", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return controller.ListDocuments(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects/"+createdProject.ID.String()+"/documents", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestDocumentController_GetProjectDocumentsPath(t *testing.T) {
	db := testDBDocument(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewDocumentController(projectRepo)

	user := &repository.User{Email: "path-ctrl@test.com", Name: "User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "Path Project",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Get("/projects/:id/documents-path", func(c *fiber.Ctx) error {
		c.Locals("userID", createdUser.ID.String())
		return controller.GetProjectDocumentsPath(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects/"+createdProject.ID.String()+"/documents-path", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestDocumentController_ListDocuments_Forbidden(t *testing.T) {
	db := testDBDocument(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewDocumentController(projectRepo)

	user := &repository.User{Email: "owner@test.com", Name: "Owner", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "Private Project",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte("[]")),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Get("/projects/:id/documents", func(c *fiber.Ctx) error {
		// Different user
		c.Locals("userID", uuid.New().String())
		return controller.ListDocuments(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects/"+createdProject.ID.String()+"/documents", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("Expected 403, got %d", resp.StatusCode)
	}
}

func TestDocumentController_ListDocuments_NotFound(t *testing.T) {
	db := testDBDocument(t)
	projectRepo := repository.NewProject(db)
	controller := NewDocumentController(projectRepo)

	app := fiber.New()
	app.Get("/projects/:id/documents", func(c *fiber.Ctx) error {
		c.Locals("userID", uuid.New().String())
		return controller.ListDocuments(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/projects/"+uuid.New().String()+"/documents", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

func TestDocumentController_Instantiation(t *testing.T) {
	db := testDBDocument(t)
	projectRepo := repository.NewProject(db)
	controller := NewDocumentController(projectRepo)

	if controller == nil {
		t.Fatal("Expected controller to be instantiated")
	}
	if controller.repo == nil {
		t.Error("Expected controller.repo to be set")
	}
}

// Note: UploadDocument, DeleteDocument, GetDocumentFile, and EmbedDocuments
// tests would require file handling and multipart form mocking.
// For comprehensive testing, these would need additional setup.
