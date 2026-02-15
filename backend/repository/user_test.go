package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

// ---------- Create ----------

func TestUserRepository_Create_Success(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	user := &User{
		Email:  "test@example.com",
		Name:   "Test User",
		Status: StatusActive,
	}

	created, err := repo.Create(user)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if created.ID == uuid.Nil {
		t.Error("Expected UUID to be generated")
	}
	if created.Email != "test@example.com" {
		t.Errorf("Expected email 'test@example.com', got %q", created.Email)
	}
	if created.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

func TestUserRepository_Create_DuplicateEmail(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create first user
	user1 := &User{
		Email:  "duplicate@test.com",
		Name:   "First User",
		Status: StatusActive,
	}
	_, err := repo.Create(user1)
	if err != nil {
		t.Fatalf("Failed to create first user: %v", err)
	}

	// Try to create second user with same email
	user2 := &User{
		Email:  "duplicate@test.com",
		Name:   "Second User",
		Status: StatusActive,
	}
	_, err = repo.Create(user2)
	if err == nil {
		t.Error("Expected error for duplicate email, got nil")
	}
	if err.Error() != "email_already_registered" {
		t.Errorf("Expected 'email_already_registered' error, got %v", err)
	}
}

func TestUserRepository_Create_DuplicateEmailCaseInsensitive(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create user with lowercase email
	user1 := &User{
		Email:  "case@test.com",
		Name:   "First User",
		Status: StatusActive,
	}
	_, err := repo.Create(user1)
	if err != nil {
		t.Fatalf("Failed to create first user: %v", err)
	}

	// Try to create user with uppercase email
	user2 := &User{
		Email:  "CASE@test.com",
		Name:   "Second User",
		Status: StatusActive,
	}
	_, err = repo.Create(user2)
	if err == nil {
		t.Error("Expected error for duplicate email (case insensitive), got nil")
	}
}

// ---------- List ----------

func TestUserRepository_List_Empty(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	users, err := repo.List()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(users) != 0 {
		t.Errorf("Expected 0 users, got %d", len(users))
	}
}

func TestUserRepository_List_Multiple(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create multiple users
	for i := 1; i <= 3; i++ {
		user := &User{
			Email:  "user" + string(rune(i+'0')) + "@test.com",
			Name:   "User " + string(rune(i+'0')),
			Status: StatusActive,
		}
		_, err := repo.Create(user)
		if err != nil {
			t.Fatalf("Failed to create user %d: %v", i, err)
		}
	}

	users, err := repo.List()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(users) != 3 {
		t.Errorf("Expected 3 users, got %d", len(users))
	}
}

// ---------- GetByID ----------

func TestUserRepository_GetByID_Found(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create a user
	created, err := repo.Create(&User{
		Email:  "getbyid@test.com",
		Name:   "Get By ID User",
		Status: StatusActive,
	})
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get by ID
	found, err := repo.GetByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found == nil {
		t.Fatal("Expected to find user, got nil")
	}
	if found.Email != "getbyid@test.com" {
		t.Errorf("Expected email 'getbyid@test.com', got %q", found.Email)
	}
}

func TestUserRepository_GetByID_NotFound(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Try to get non-existent user
	found, err := repo.GetByID(uuid.New().String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found != nil {
		t.Error("Expected nil for non-existent user, got user")
	}
}

// ---------- GetByEmail ----------

func TestUserRepository_GetByEmail_Found(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create a user
	_, err := repo.Create(&User{
		Email:  "getbyemail@test.com",
		Name:   "Get By Email User",
		Status: StatusActive,
	})
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get by email
	found, err := repo.GetByEmail("getbyemail@test.com")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found == nil {
		t.Fatal("Expected to find user, got nil")
	}
	if found.Email != "getbyemail@test.com" {
		t.Errorf("Expected email 'getbyemail@test.com', got %q", found.Email)
	}
}

func TestUserRepository_GetByEmail_CaseInsensitive(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create user with lowercase email
	_, err := repo.Create(&User{
		Email:  "case@test.com",
		Name:   "Case Test User",
		Status: StatusActive,
	})
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Search with uppercase email
	found, err := repo.GetByEmail("CASE@test.com")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found == nil {
		t.Fatal("Expected to find user (case insensitive), got nil")
	}
	if found.Email != "case@test.com" {
		t.Errorf("Expected email 'case@test.com', got %q", found.Email)
	}
}

func TestUserRepository_GetByEmail_NotFound(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Try to get non-existent user
	found, err := repo.GetByEmail("nonexistent@test.com")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found != nil {
		t.Error("Expected nil for non-existent user, got user")
	}
}

// ---------- Update ----------

func TestUserRepository_Update_Success(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create a user
	created, err := repo.Create(&User{
		Email:  "update@test.com",
		Name:   "Before Update",
		Status: StatusActive,
	})
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Wait a bit to ensure UpdatedAt is different
	time.Sleep(10 * time.Millisecond)

	// Update the user
	payload := map[string]interface{}{
		"name": "After Update",
	}
	updated, err := repo.Update(created.ID.String(), payload)
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

func TestUserRepository_Update_EmailUniqueness(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create two users
	user1, err := repo.Create(&User{
		Email:  "user1@test.com",
		Name:   "User 1",
		Status: StatusActive,
	})
	if err != nil {
		t.Fatalf("Failed to create user1: %v", err)
	}

	_, err = repo.Create(&User{
		Email:  "user2@test.com",
		Name:   "User 2",
		Status: StatusActive,
	})
	if err != nil {
		t.Fatalf("Failed to create user2: %v", err)
	}

	// Try to update user1's email to user2's email
	payload := map[string]interface{}{
		"email": "user2@test.com",
	}
	_, err = repo.Update(user1.ID.String(), payload)
	if err == nil {
		t.Error("Expected error for duplicate email, got nil")
	}
	if err.Error() != "email_already_registered" {
		t.Errorf("Expected 'email_already_registered' error, got %v", err)
	}
}

func TestUserRepository_Update_NotFound(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Try to update non-existent user
	payload := map[string]interface{}{
		"name": "Updated Name",
	}
	updated, err := repo.Update(uuid.New().String(), payload)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if updated != nil {
		t.Error("Expected nil for non-existent user, got user")
	}
}

// ---------- Delete ----------

func TestUserRepository_Delete_Success(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Create a user
	created, err := repo.Create(&User{
		Email:  "delete@test.com",
		Name:   "Delete Me",
		Status: StatusActive,
	})
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Delete the user
	deleted, err := repo.Delete(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !deleted {
		t.Error("Expected deleted to be true")
	}

	// Verify user is deleted
	found, err := repo.GetByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error checking deleted user, got %v", err)
	}
	if found != nil {
		t.Error("Expected user to be deleted, but still found")
	}
}

func TestUserRepository_Delete_NotFound(t *testing.T) {
	db := testDB(t)
	repo := New(db)

	// Try to delete non-existent user
	deleted, err := repo.Delete(uuid.New().String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if deleted {
		t.Error("Expected deleted to be false for non-existent user")
	}
}

// ---------- BeforeCreate Hook ----------

func TestUser_BeforeCreate_GeneratesUUID(t *testing.T) {
	db := testDB(t)

	user := &User{
		Email:  "hook@test.com",
		Name:   "Hook Test",
		Status: StatusActive,
	}

	// Before creation, ID should be empty
	if user.ID != uuid.Nil {
		t.Error("Expected ID to be nil before creation")
	}

	// Create user
	err := db.Create(user).Error
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// After creation, ID should be generated
	if user.ID == uuid.Nil {
		t.Error("Expected ID to be generated by BeforeCreate hook")
	}
}

func TestUser_BeforeCreate_SetsCreatedAt(t *testing.T) {
	db := testDB(t)

	user := &User{
		Email:  "timestamp@test.com",
		Name:   "Timestamp Test",
		Status: StatusActive,
	}

	// Before creation, CreatedAt should be zero
	if !user.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be zero before creation")
	}

	// Create user
	err := db.Create(user).Error
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// After creation, CreatedAt should be set
	if user.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set by BeforeCreate hook")
	}
}
