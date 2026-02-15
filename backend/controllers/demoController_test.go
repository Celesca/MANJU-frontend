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

// testDBDemo creates a test database connection for demo tests
func testDBDemo(t *testing.T) *gorm.DB {
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

// ---------- DemoController Tests ----------

func TestDemoController_GetWorkflowType(t *testing.T) {
	db := testDBDemo(t)
	projectRepo := repository.NewProject(db)
	userRepo := repository.New(db)
	controller := NewDemoController(projectRepo)

	user := &repository.User{Email: "demo-ctrl@test.com", Name: "Demo User", Status: repository.StatusActive}
	createdUser, _ := userRepo.Create(user)

	project := &repository.Project{
		UserID:      createdUser.ID,
		Name:        "Demo Project",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte(`[{"type":"text-input"},{"type":"ai-model"},{"type":"text-output"}]`)),
		Connections: datatypes.JSON([]byte("[]")),
	}
	createdProject, _ := projectRepo.Create(project)

	app := fiber.New()
	app.Get("/projects/:id/workflow-type", controller.GetWorkflowType)

	req := httptest.NewRequest(http.MethodGet, "/projects/"+createdProject.ID.String()+"/workflow-type", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
}

func TestDemoController_GetWorkflowType_NotFound(t *testing.T) {
	db := testDBDemo(t)
	projectRepo := repository.NewProject(db)
	controller := NewDemoController(projectRepo)

	app := fiber.New()
	app.Get("/projects/:id/workflow-type", controller.GetWorkflowType)

	req := httptest.NewRequest(http.MethodGet, "/projects/"+uuid.New().String()+"/workflow-type", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected 404, got %d", resp.StatusCode)
	}
}

func TestDemoController_Instantiation(t *testing.T) {
	db := testDBDemo(t)
	projectRepo := repository.NewProject(db)
	controller := NewDemoController(projectRepo)

	if controller == nil {
		t.Fatal("Expected controller to be instantiated")
	}
	if controller.repo == nil {
		t.Error("Expected controller.repo to be set")
	}
}

// Note: DemoProject, ValidateWorkflow, and GenerateTTS tests would require
// mocking the external AI service HTTP calls. For now, we test the basic
// controller methods that don't require external dependencies.
