package repository

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserAPIKey stores encrypted API keys for users
type UserAPIKey struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Label        string    `gorm:"not null" json:"label"`
	EncryptedKey string    `gorm:"type:text;not null" json:"-"` // Never expose in JSON
	MaskedKey    string    `gorm:"-" json:"masked_key"`         // Computed, not stored
	Provider     string    `gorm:"default:'openai'" json:"provider"`
	IsDefault    bool      `gorm:"default:false" json:"is_default"`
	CreatedAt    time.Time `gorm:"default:now()" json:"created_at"`
}

// BeforeCreate hook to ensure UUID
func (k *UserAPIKey) BeforeCreate(tx *gorm.DB) (err error) {
	if k.ID == uuid.Nil {
		k.ID = uuid.New()
	}
	if k.CreatedAt.IsZero() {
		k.CreatedAt = time.Now()
	}
	return nil
}

// UserAPIKeyRepository handles database operations for API keys
type UserAPIKeyRepository struct {
	db *gorm.DB
}

// NewUserAPIKeyRepository creates a new repository
func NewUserAPIKeyRepository(db *gorm.DB) *UserAPIKeyRepository {
	return &UserAPIKeyRepository{db: db}
}

// Create adds a new API key
func (r *UserAPIKeyRepository) Create(key *UserAPIKey) (*UserAPIKey, error) {
	if err := r.db.Create(key).Error; err != nil {
		return nil, err
	}
	return key, nil
}

// ListByUserID returns all API keys for a user
func (r *UserAPIKeyRepository) ListByUserID(userID string) ([]UserAPIKey, error) {
	var keys []UserAPIKey
	if err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&keys).Error; err != nil {
		return nil, err
	}
	return keys, nil
}

// GetByID returns a single API key
func (r *UserAPIKeyRepository) GetByID(keyID string) (*UserAPIKey, error) {
	var key UserAPIKey
	if err := r.db.Where("id = ?", keyID).First(&key).Error; err != nil {
		return nil, err
	}
	return &key, nil
}

// Delete removes an API key
func (r *UserAPIKeyRepository) Delete(keyID string, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", keyID, userID).Delete(&UserAPIKey{}).Error
}

// SetDefault marks a key as default and unsets others
func (r *UserAPIKeyRepository) SetDefault(keyID string, userID string) error {
	// Unset all defaults for user
	r.db.Model(&UserAPIKey{}).Where("user_id = ?", userID).Update("is_default", false)
	// Set new default
	return r.db.Model(&UserAPIKey{}).Where("id = ? AND user_id = ?", keyID, userID).Update("is_default", true).Error
}

// GetDefaultByUserID returns the default API key for a user
func (r *UserAPIKeyRepository) GetDefaultByUserID(userID string) (*UserAPIKey, error) {
	var key UserAPIKey
	if err := r.db.Where("user_id = ? AND is_default = ?", userID, true).First(&key).Error; err != nil {
		return nil, err
	}
	return &key, nil
}
