package repository

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Status type
type Status string

const (
	StatusActive    Status = "active"
	StatusInactive  Status = "inactive"
	StatusSuspended Status = "suspended"
)

// User model
type User struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	Email     string         `gorm:"unique;not null" json:"email"`
	Name      string         `gorm:"not null" json:"name"`
	Info      datatypes.JSON `gorm:"type:jsonb" json:"info"`
	Status    Status         `json:"status"`
	CreatedAt time.Time      `gorm:"default:now()" json:"created_at"`
	UpdatedAt *time.Time     `json:"updated_at"`
}

// BeforeCreate hook to ensure UUID for SQLite
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil { // generate a new uuid if empty
		u.ID = uuid.New()
	}
	if u.CreatedAt.IsZero() {
		u.CreatedAt = time.Now()
	}
	return nil
}

// Repository holds DB
type UserRepository struct {
	db *gorm.DB
}

func New(db *gorm.DB) *UserRepository {
	return &UserRepository{db}
}

// Create user
func (r *UserRepository) Create(u *User) (*User, error) {
	// check unique email
	var existing User
	if err := r.db.Where("lower(email) = lower(?)", u.Email).First(&existing).Error; err == nil {
		return nil, errors.New("email_already_registered")
	}

	if err := r.db.Create(u).Error; err != nil {
		return nil, err
	}
	return u, nil
}

// List users
func (r *UserRepository) List() ([]User, error) {
	var users []User
	if err := r.db.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

// Get by ID
func (r *UserRepository) GetByID(id string) (*User, error) {
	var user User
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetByEmail returns a user by email (case-insensitive)
func (r *UserRepository) GetByEmail(email string) (*User, error) {
	var user User
	if err := r.db.Where("lower(email) = lower(?)", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// Update user
func (r *UserRepository) Update(id string, payload map[string]interface{}) (*User, error) {
	user, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, nil
	}

	// If updating email - check uniqueness
	if email, ok := payload["email"]; ok {
		var existing User
		if err := r.db.Where("lower(email) = lower(?) AND id<>?", email, id).First(&existing).Error; err == nil {
			return nil, errors.New("email_already_registered")
		}
	}

	payload["updated_at"] = time.Now()

	if err := r.db.Model(user).Updates(payload).Error; err != nil {
		return nil, err
	}

	// reload
	if err := r.db.Where("id = ?", id).First(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

// Delete user
func (r *UserRepository) Delete(id string) (bool, error) {
	res := r.db.Delete(&User{}, "id = ?", id)
	return res.RowsAffected > 0, res.Error
}
