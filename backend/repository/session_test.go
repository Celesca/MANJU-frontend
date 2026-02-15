package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

// ---------- Create ----------

func TestSessionRepository_Create_Success(t *testing.T) {
	db := testDB(t)
	repo := NewSession(db)

	userID := uuid.New()
	expiresAt := time.Now().Add(24 * time.Hour)

	session := &Session{
		UserID:       userID,
		RefreshToken: "refresh_token_xyz",
		ExpiresAt:    &expiresAt,
	}

	created, err := repo.Create(session)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if created.ID == uuid.Nil {
		t.Error("Expected UUID to be generated")
	}
	if created.RefreshToken != "refresh_token_xyz" {
		t.Errorf("Expected refresh token 'refresh_token_xyz', got %q", created.RefreshToken)
	}
	if created.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

// ---------- GetByID ----------

func TestSessionRepository_GetByID_Found(t *testing.T) {
	db := testDB(t)
	repo := NewSession(db)

	userID := uuid.New()
	expiresAt := time.Now().Add(24 * time.Hour)

	created, err := repo.Create(&Session{
		UserID:       userID,
		RefreshToken: "test_token",
		ExpiresAt:    &expiresAt,
	})
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Get by ID
	found, err := repo.GetByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found == nil {
		t.Fatal("Expected to find session, got nil")
	}
	if found.RefreshToken != "test_token" {
		t.Errorf("Expected refresh token 'test_token', got %q", found.RefreshToken)
	}
}

func TestSessionRepository_GetByID_NotFound(t *testing.T) {
	db := testDB(t)
	repo := NewSession(db)

	_, err := repo.GetByID(uuid.New().String())
	if err == nil {
		t.Error("Expected error for non-existent session, got nil")
	}
}

// ---------- DeleteByID ----------

func TestSessionRepository_DeleteByID_Success(t *testing.T) {
	db := testDB(t)
	repo := NewSession(db)

	userID := uuid.New()
	expiresAt := time.Now().Add(24 * time.Hour)

	created, err := repo.Create(&Session{
		UserID:       userID,
		RefreshToken: "delete_me",
		ExpiresAt:    &expiresAt,
	})
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Delete
	err = repo.DeleteByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify deletion
	_, err = repo.GetByID(created.ID.String())
	if err == nil {
		t.Error("Expected error for deleted session, got nil")
	}
}

func TestSessionRepository_DeleteByID_NotFound(t *testing.T) {
	db := testDB(t)
	repo := NewSession(db)

	// Try to delete non-existent session (should not error, just no-op)
	err := repo.DeleteByID(uuid.New().String())
	if err != nil {
		t.Fatalf("Expected no error for deleting non-existent session, got %v", err)
	}
}
