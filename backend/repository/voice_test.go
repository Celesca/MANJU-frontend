package repository

import (
	"testing"

	"github.com/google/uuid"
)

// ---------- Create ----------

func TestVoiceRepository_Create_Success(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	userID := uuid.New()
	voice := &Voice{
		VoiceName: "My Voice",
		VoiceURL:  "https://example.com/voice.wav",
		RefText:   "This is a reference text",
		Gender:    "female",
		AgeRange:  "adult",
		Language:  "en",
		UserID:    userID,
	}

	created, err := repo.Create(voice)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if created.ID == uuid.Nil {
		t.Error("Expected UUID to be generated")
	}
	if created.VoiceName != "My Voice" {
		t.Errorf("Expected voice name 'My Voice', got %q", created.VoiceName)
	}
	if created.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

// ---------- List ----------

func TestVoiceRepository_List_Empty(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	voices, err := repo.List()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(voices) != 0 {
		t.Errorf("Expected 0 voices, got %d", len(voices))
	}
}

func TestVoiceRepository_List_Multiple(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	userID := uuid.New()

	// Create multiple voices
	for i := 1; i <= 3; i++ {
		_, err := repo.Create(&Voice{
			VoiceName: "Voice " + string(rune(i+'0')),
			VoiceURL:  "https://example.com/voice" + string(rune(i+'0')) + ".wav",
			UserID:    userID,
		})
		if err != nil {
			t.Fatalf("Failed to create voice %d: %v", i, err)
		}
	}

	voices, err := repo.List()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(voices) != 3 {
		t.Errorf("Expected 3 voices, got %d", len(voices))
	}
}

// ---------- GetByID ----------

func TestVoiceRepository_GetByID_Found(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	userID := uuid.New()
	created, err := repo.Create(&Voice{
		VoiceName: "Get Test Voice",
		VoiceURL:  "https://example.com/voice.wav",
		UserID:    userID,
	})
	if err != nil {
		t.Fatalf("Failed to create voice: %v", err)
	}

	// Get by ID
	found, err := repo.GetByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found == nil {
		t.Fatal("Expected to find voice, got nil")
	}
	if found.VoiceName != "Get Test Voice" {
		t.Errorf("Expected voice name 'Get Test Voice', got %q", found.VoiceName)
	}
}

func TestVoiceRepository_GetByID_NotFound(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	// Try to get non-existent voice
	found, err := repo.GetByID(uuid.New().String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if found != nil {
		t.Error("Expected nil for non-existent voice, got voice")
	}
}

// ---------- ListByUser ----------

func TestVoiceRepository_ListByUser_Empty(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	userID := uuid.New()
	voices, err := repo.ListByUser(userID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(voices) != 0 {
		t.Errorf("Expected 0 voices, got %d", len(voices))
	}
}

func TestVoiceRepository_ListByUser_FiltersByUser(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	user1 := uuid.New()
	user2 := uuid.New()

	// Create voices for user1
	_, err := repo.Create(&Voice{
		VoiceName: "User1 Voice 1",
		VoiceURL:  "https://example.com/voice1.wav",
		UserID:    user1,
	})
	if err != nil {
		t.Fatalf("Failed to create voice for user1: %v", err)
	}

	_, err = repo.Create(&Voice{
		VoiceName: "User1 Voice 2",
		VoiceURL:  "https://example.com/voice2.wav",
		UserID:    user1,
	})
	if err != nil {
		t.Fatalf("Failed to create second voice for user1: %v", err)
	}

	// Create voice for user2
	_, err = repo.Create(&Voice{
		VoiceName: "User2 Voice",
		VoiceURL:  "https://example.com/voice3.wav",
		UserID:    user2,
	})
	if err != nil {
		t.Fatalf("Failed to create voice for user2: %v", err)
	}

	// Get voices for user1
	voices, err := repo.ListByUser(user1.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(voices) != 2 {
		t.Errorf("Expected 2 voices for user1, got %d", len(voices))
	}

	// Verify all voices belong to user1
	for _, voice := range voices {
		if voice.UserID != user1 {
			t.Error("Expected all voices to belong to user1")
		}
	}
}

// ---------- Delete ----------

func TestVoiceRepository_Delete_Success(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	userID := uuid.New()
	created, err := repo.Create(&Voice{
		VoiceName: "Delete Me",
		VoiceURL:  "https://example.com/voice.wav",
		UserID:    userID,
	})
	if err != nil {
		t.Fatalf("Failed to create voice: %v", err)
	}

	// Delete
	deleted, err := repo.Delete(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !deleted {
		t.Error("Expected deleted to be true")
	}

	// Verify deletion
	found, err := repo.GetByID(created.ID.String())
	if err != nil {
		t.Fatalf("Expected no error checking deleted voice, got %v", err)
	}
	if found != nil {
		t.Error("Expected voice to be deleted, but still found")
	}
}

func TestVoiceRepository_Delete_NotFound(t *testing.T) {
	db := testDB(t)
	repo := NewVoice(db)

	// Try to delete non-existent voice
	deleted, err := repo.Delete(uuid.New().String())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if deleted {
		t.Error("Expected deleted to be false for non-existent voice")
	}
}

// ---------- BeforeCreate Hook ----------

func TestVoice_BeforeCreate_GeneratesUUID(t *testing.T) {
	db := testDB(t)

	voice := &Voice{
		VoiceName: "Hook Test",
		VoiceURL:  "https://example.com/voice.wav",
		UserID:    uuid.New(),
	}

	// Before creation, ID should be empty
	if voice.ID != uuid.Nil {
		t.Error("Expected ID to be nil before creation")
	}

	// Create
	err := db.Create(voice).Error
	if err != nil {
		t.Fatalf("Failed to create voice: %v", err)
	}

	// After creation, ID should be generated
	if voice.ID == uuid.Nil {
		t.Error("Expected ID to be generated by BeforeCreate hook")
	}
}

func TestVoice_BeforeCreate_SetsCreatedAt(t *testing.T) {
	db := testDB(t)

	voice := &Voice{
		VoiceName: "Timestamp Test",
		VoiceURL:  "https://example.com/voice.wav",
		UserID:    uuid.New(),
	}

	// Before creation, CreatedAt should be zero
	if !voice.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be zero before creation")
	}

	// Create
	err := db.Create(voice).Error
	if err != nil {
		t.Fatalf("Failed to create voice: %v", err)
	}

	// After creation, CreatedAt should be set
	if voice.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set by BeforeCreate hook")
	}
}
