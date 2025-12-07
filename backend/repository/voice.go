package repository

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Voice model
type Voice struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	VoiceName string     `gorm:"not null" json:"voice_name"`
	VoiceURL  string     `gorm:"not null" json:"voice_url"`
	RefText   string     `json:"ref_text"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	CreatedAt time.Time  `gorm:"default:now()" json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at"`
}

func (v *Voice) BeforeCreate(tx *gorm.DB) (err error) {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	if v.CreatedAt.IsZero() {
		v.CreatedAt = time.Now()
	}
	return nil
}

type VoiceRepository struct {
	db *gorm.DB
}

func NewVoice(db *gorm.DB) *VoiceRepository {
	return &VoiceRepository{db}
}

func (r *VoiceRepository) Create(v *Voice) (*Voice, error) {
	if err := r.db.Create(v).Error; err != nil {
		return nil, err
	}
	return v, nil
}

func (r *VoiceRepository) List() ([]Voice, error) {
	var voices []Voice
	if err := r.db.Find(&voices).Error; err != nil {
		return nil, err
	}
	return voices, nil
}

func (r *VoiceRepository) GetByID(id string) (*Voice, error) {
	var v Voice
	if err := r.db.Where("id = ?", id).First(&v).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *VoiceRepository) ListByUser(userID string) ([]Voice, error) {
	var voices []Voice
	if err := r.db.Where("user_id = ?", userID).Find(&voices).Error; err != nil {
		return nil, err
	}
	return voices, nil
}

func (r *VoiceRepository) Delete(id string) (bool, error) {
	res := r.db.Delete(&Voice{}, "id = ?", id)
	return res.RowsAffected > 0, res.Error
}
