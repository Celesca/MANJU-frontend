package repository

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Session model stores server-side session and refresh token
type Session struct {
	ID           uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID       uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	RefreshToken string     `gorm:"type:text" json:"refresh_token"`
	ExpiresAt    *time.Time `json:"expires_at"`
	CreatedAt    time.Time  `gorm:"default:now()" json:"created_at"`
}

type SessionRepository struct {
	db *gorm.DB
}

func NewSession(db *gorm.DB) *SessionRepository {
	return &SessionRepository{db}
}

func (r *SessionRepository) Create(s *Session) (*Session, error) {
	if err := r.db.Create(s).Error; err != nil {
		return nil, err
	}
	return s, nil
}

func (r *SessionRepository) GetByID(id string) (*Session, error) {
	var s Session
	if err := r.db.Where("id = ?", id).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *SessionRepository) DeleteByID(id string) error {
	return r.db.Delete(&Session{}, "id = ?", id).Error
}
