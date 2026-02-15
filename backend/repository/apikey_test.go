package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

// ---------- Create ----------

func TestUserAPIKeyRepository_Create_Success(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()
	apiKey := &UserAPIKey{
		UserID:       userID,
		Label:        "My OpenAI Key",
		EncryptedKey: "encrypted_key_data",
		Provider:     "openai",
		IsDefault:    false,
	}

	created, err := repo.Create(apiKey)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if created.ID == uuid.Nil {
		t.Error("Expected UUID to be generated")
	}
	if created.Label != "My OpenAI Key" {
		t.Errorf("Expected label 'My OpenAI Key', got %q", created.Label)
	}
	if created.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

// ---------- ListByUserID ----------

func TestUserAPIKeyRepository_ListByUserID_Empty(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()
	keys, err := repo.ListByUserID(userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(keys) != 0 {
		t.Errorf("Expected 0 keys, got %d", len(keys))
	}
}

func TestUserAPIKeyRepository_ListByUserID_OrderedByCreatedAt(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()

	// Create three keys with slight time delays
	key1 := &UserAPIKey{
		UserID:       userID,
		Label:        "First Key",
		EncryptedKey: "key1",
		Provider:     "openai",
	}
	created1, err := repo.Create(key1)
	if err != nil {
		t.Fatalf("Failed to create key1: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	key2 := &UserAPIKey{
		UserID:       userID,
		Label:        "Second Key",
		EncryptedKey: "key2",
		Provider:     "openai",
	}
	created2, err := repo.Create(key2)
	if err != nil {
		t.Fatalf("Failed to create key2: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	key3 := &UserAPIKey{
		UserID:       userID,
		Label:        "Third Key",
		EncryptedKey: "key3",
		Provider:     "openai",
	}
	created3, err := repo.Create(key3)
	if err != nil {
		t.Fatalf("Failed to create key3: %v", err)
	}

	// List keys
	keys, err := repo.ListByUserID(userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(keys) != 3 {
		t.Fatalf("Expected 3 keys, got %d", len(keys))
	}

	// Verify descending order (newest first)
	if keys[0].ID != created3.ID {
		t.Error("Expected third key to be first (DESC order)")
	}
	if keys[1].ID != created2.ID {
		t.Error("Expected second key to be second")
	}
	if keys[2].ID != created1.ID {
		t.Error("Expected first key to be third")
	}
}

// ---------- GetByID ----------

func TestUserAPIKeyRepository_GetByID_Found(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()
	created, err := repo.Create(&UserAPIKey{
		UserID:       userID,
		Label:        "Test Key",
		EncryptedKey: "encrypted",
		Provider:     "openai",
	})
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	// Get by ID
	found, err := repo.GetByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found == nil {
		t.Fatal("Expected to find key, got nil")
	}
	if found.Label != "Test Key" {
		t.Errorf("Expected label 'Test Key', got %q", found.Label)
	}
}

func TestUserAPIKeyRepository_GetByID_NotFound(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	_, err := repo.GetByID(uuid.New().String())
	if err == nil {
		t.Error("Expected error for non-existent key, got nil")
	}
}

// ---------- Delete ----------

func TestUserAPIKeyRepository_Delete_Success(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()
	created, err := repo.Create(&UserAPIKey{
		UserID:       userID,
		Label:        "Delete Me",
		EncryptedKey: "encrypted",
		Provider:     "openai",
	})
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	// Delete the key
	err = repo.Delete(created.ID.String(), userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify deletion
	_, err = repo.GetByID(created.ID.String())
	if err == nil {
		t.Error("Expected error for deleted key, got nil")
	}
}

func TestUserAPIKeyRepository_Delete_WrongUser(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()
	otherUserID := uuid.New()

	created, err := repo.Create(&UserAPIKey{
		UserID:       userID,
		Label:        "My Key",
		EncryptedKey: "encrypted",
		Provider:     "openai",
	})
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	// Try to delete with wrong user ID
	err = repo.Delete(created.ID.String(), otherUserID.String())
	if err != nil {
		t.Fatalf("Expected no error (silently no-op), got %v", err)
	}

	// Verify key still exists
	found, err := repo.GetByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected to find key, got error: %v", err)
	}
	if found == nil {
		t.Error("Expected key to still exist after delete with wrong user ID")
	}
}

// ---------- SetDefault ----------

func TestUserAPIKeyRepository_SetDefault_Success(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()

	// Create two keys
	key1, err := repo.Create(&UserAPIKey{
		UserID:       userID,
		Label:        "Key 1",
		EncryptedKey: "key1",
		Provider:     "openai",
		IsDefault:    true,
	})
	if err != nil {
		t.Fatalf("Failed to create key1: %v", err)
	}

	key2, err := repo.Create(&UserAPIKey{
		UserID:       userID,
		Label:        "Key 2",
		EncryptedKey: "key2",
		Provider:     "openai",
		IsDefault:    false,
	})
	if err != nil {
		t.Fatalf("Failed to create key2: %v", err)
	}

	// Set key2 as default
	err = repo.SetDefault(key2.ID.String(), userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify key1 is no longer default
	found1, err := repo.GetByID(key1.ID.String())
	if err != nil {
		t.Fatalf("Failed to get key1: %v", err)
	}
	if found1.IsDefault {
		t.Error("Expected key1 to no longer be default")
	}

	// Verify key2 is default
	found2, err := repo.GetByID(key2.ID.String())
	if err != nil {
		t.Fatalf("Failed to get key2: %v", err)
	}
	if !found2.IsDefault {
		t.Error("Expected key2 to be default")
	}
}

// ---------- GetDefaultByUserID ----------

func TestUserAPIKeyRepository_GetDefaultByUserID_Found(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()

	// Create a default key
	created, err := repo.Create(&UserAPIKey{
		UserID:       userID,
		Label:        "Default Key",
		EncryptedKey: "encrypted",
		Provider:     "openai",
		IsDefault:    true,
	})
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	// Get default key
	defaultKey, err := repo.GetDefaultByUserID(userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if defaultKey == nil {
		t.Fatal("Expected to find default key, got nil")
	}
	if defaultKey.ID != created.ID {
		t.Error("Expected to find the created default key")
	}
}

func TestUserAPIKeyRepository_GetDefaultByUserID_NotFound(t *testing.T) {
	db := testDB(t)
	repo := NewUserAPIKeyRepository(db)

	userID := uuid.New()

	// Try to get default key when none exists
	_, err := repo.GetDefaultByUserID(userID.String())
	if err == nil {
		t.Error("Expected error for non-existent default key, got nil")
	}
}

// ---------- BeforeCreate Hook ----------

func TestUserAPIKey_BeforeCreate_GeneratesUUID(t *testing.T) {
	db := testDB(t)

	apiKey := &UserAPIKey{
		UserID:       uuid.New(),
		Label:        "Hook Test",
		EncryptedKey: "encrypted",
		Provider:     "openai",
	}

	// Before creation, ID should be empty
	if apiKey.ID != uuid.Nil {
		t.Error("Expected ID to be nil before creation")
	}

	// Create key
	err := db.Create(apiKey).Error
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	// After creation, ID should be generated
	if apiKey.ID == uuid.Nil {
		t.Error("Expected ID to be generated by BeforeCreate hook")
	}
}

func TestUserAPIKey_BeforeCreate_SetsCreatedAt(t *testing.T) {
	db := testDB(t)

	apiKey := &UserAPIKey{
		UserID:       uuid.New(),
		Label:        "Timestamp Test",
		EncryptedKey: "encrypted",
		Provider:     "openai",
	}

	// Before creation, CreatedAt should be zero
	if !apiKey.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be zero before creation")
	}

	// Create key
	err := db.Create(apiKey).Error
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	// After creation, CreatedAt should be set
	if apiKey.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set by BeforeCreate hook")
	}
}
