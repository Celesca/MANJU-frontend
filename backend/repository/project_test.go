package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ---------- Create ----------

func TestProjectRepository_Create_Success(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	userID := uuid.New()
	project := &Project{
		UserID:      userID,
		Name:        "My First Project",
		Description: "Test project description",
		Status:      "draft",
		Nodes:       datatypes.JSON([]byte(`[{"id":"1","type":"input"}]`)),
		Connections: datatypes.JSON([]byte(`[]`)),
	}

	created, err := repo.Create(project)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if created.ID == uuid.Nil {
		t.Error("Expected UUID to be generated")
	}
	if created.Name != "My First Project" {
		t.Errorf("Expected name 'My First Project', got %q", created.Name)
	}
	if created.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

// ---------- GetByID ----------

func TestProjectRepository_GetByID_Found(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	userID := uuid.New()
	created, err := repo.Create(&Project{
		UserID:      userID,
		Name:        "Get Test",
		Description: "Test",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// Get by ID
	found, err := repo.GetByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found == nil {
		t.Fatal("Expected to find project, got nil")
	}
	if found.Name != "Get Test" {
		t.Errorf("Expected name 'Get Test', got %q", found.Name)
	}
}

func TestProjectRepository_GetByID_NotFound(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	_, err := repo.GetByID(uuid.New().String())
	if err == nil {
		t.Error("Expected error for non-existent project, got nil")
	}
}

// ---------- GetByUserID ----------

func TestProjectRepository_GetByUserID_Empty(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	userID := uuid.New()
	projects, err := repo.GetByUserID(userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects, got %d", len(projects))
	}
}

func TestProjectRepository_GetByUserID_OrderedCorrectly(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	userID := uuid.New()

	// Create first project
	project1, err := repo.Create(&Project{
		UserID:      userID,
		Name:        "Project 1",
		Description: "First",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project1: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	// Create second project
	project2, err := repo.Create(&Project{
		UserID:      userID,
		Name:        "Project 2",
		Description: "Second",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project2: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	// Update project1 (should move it to top)
	project1.Name = "Project 1 Updated"
	_, err = repo.Update(project1)
	if err != nil {
		t.Fatalf("Failed to update project1: %v", err)
	}

	// Get projects
	projects, err := repo.GetByUserID(userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(projects) != 2 {
		t.Fatalf("Expected 2 projects, got %d", len(projects))
	}

	// Verify order: project1 should be first (most recently updated)
	if projects[0].ID != project1.ID {
		t.Error("Expected project1 to be first (most recently updated)")
	}
	if projects[1].ID != project2.ID {
		t.Error("Expected project2 to be second")
	}
}

// ---------- ListAll ----------

func TestProjectRepository_ListAll_Empty(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	projects, err := repo.ListAll()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects, got %d", len(projects))
	}
}

func TestProjectRepository_ListAll_MultipleUsers(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	user1 := uuid.New()
	user2 := uuid.New()

	// Create projects for different users
	_, err := repo.Create(&Project{
		UserID:      user1,
		Name:        "User1 Project",
		Description: "Test",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project for user1: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	_, err = repo.Create(&Project{
		UserID:      user2,
		Name:        "User2 Project",
		Description: "Test",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project for user2: %v", err)
	}

	// List all
	projects, err := repo.ListAll()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(projects) != 2 {
		t.Fatalf("Expected 2 projects, got %d", len(projects))
	}
}

// ---------- Update ----------

func TestProjectRepository_Update_Success(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	userID := uuid.New()
	created, err := repo.Create(&Project{
		UserID:      userID,
		Name:        "Before Update",
		Description: "Old description",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// Wait to ensure UpdatedAt is different
	time.Sleep(10 * time.Millisecond)

	// Update
	created.Name = "After Update"
	created.Description = "New description"
	updated, err := repo.Update(created)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if updated.Name != "After Update" {
		t.Errorf("Expected name 'After Update', got %q", updated.Name)
	}
	if updated.UpdatedAt == nil {
		t.Error("Expected UpdatedAt to be set")
	}
}

// ---------- Delete ----------

func TestProjectRepository_Delete_Success(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	userID := uuid.New()
	created, err := repo.Create(&Project{
		UserID:      userID,
		Name:        "Delete Me",
		Description: "Will be deleted",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// Delete
	err = repo.Delete(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify deletion
	_, err = repo.GetByID(created.ID.String())
	if err == nil {
		t.Error("Expected error for deleted project, got nil")
	}
}

// ---------- DeleteByUserID ----------

func TestProjectRepository_DeleteByUserID_Success(t *testing.T) {
	db := testDB(t)
	repo := NewProject(db)

	userID := uuid.New()

	// Create multiple projects for the user
	_, err := repo.Create(&Project{
		UserID:      userID,
		Name:        "Project 1",
		Description: "Test",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project1: %v", err)
	}

	_, err = repo.Create(&Project{
		UserID:      userID,
		Name:        "Project 2",
		Description: "Test",
		Status:      "draft",
	})
	if err != nil {
		t.Fatalf("Failed to create project2: %v", err)
	}

	// Delete all projects for user
	err = repo.DeleteByUserID(userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify deletion
	projects, err := repo.GetByUserID(userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects after DeleteByUserID, got %d", len(projects))
	}
}

// ---------- Hooks ----------

func TestProject_BeforeCreate_GeneratesUUID(t *testing.T) {
	db := testDB(t)

	project := &Project{
		UserID:      uuid.New(),
		Name:        "Hook Test",
		Description: "Test",
		Status:      "draft",
	}

	// Before creation, ID should be empty
	if project.ID != uuid.Nil {
		t.Error("Expected ID to be nil before creation")
	}

	// Create
	err := db.Create(project).Error
	if err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// After creation, ID should be generated
	if project.ID == uuid.Nil {
		t.Error("Expected ID to be generated by BeforeCreate hook")
	}
}

func TestProject_BeforeUpdate_SetsUpdatedAt(t *testing.T) {
	db := testDB(t)

	project := &Project{
		UserID:      uuid.New(),
		Name:        "Before Update",
		Description: "Test",
		Status:      "draft",
	}

	// Create
	err := db.Create(project).Error
	if err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// Before update, UpdatedAt should be nil
	if project.UpdatedAt != nil {
		t.Error("Expected UpdatedAt to be nil before update")
	}

	time.Sleep(10 * time.Millisecond)

	// Update
	project.Name = "After Update"
	err = db.Save(project).Error
	if err != nil {
		t.Fatalf("Failed to update project: %v", err)
	}

	// After update, UpdatedAt should be set
	if project.UpdatedAt == nil {
		t.Error("Expected UpdatedAt to be set by BeforeUpdate hook")
	}
}
