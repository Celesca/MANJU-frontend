package repository

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Project represents a workflow project owned by a user
type Project struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	Nodes       datatypes.JSON `gorm:"type:jsonb" json:"nodes"`       // Workflow nodes as JSON
	Connections datatypes.JSON `gorm:"type:jsonb" json:"connections"` // Workflow connections as JSON
	Status      string         `gorm:"default:'draft'" json:"status"` // draft, active, archived
	CreatedAt   time.Time      `gorm:"default:now()" json:"created_at"`
	UpdatedAt   *time.Time     `json:"updated_at"`
}

// BeforeCreate hook to ensure UUID
func (p *Project) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now()
	}
	return nil
}

// BeforeUpdate hook to set UpdatedAt
func (p *Project) BeforeUpdate(tx *gorm.DB) (err error) {
	now := time.Now()
	p.UpdatedAt = &now
	return nil
}

// ProjectRepository handles project database operations
type ProjectRepository struct {
	db *gorm.DB
}

// NewProject creates a new ProjectRepository
func NewProject(db *gorm.DB) *ProjectRepository {
	return &ProjectRepository{db}
}

// Create creates a new project
func (r *ProjectRepository) Create(p *Project) (*Project, error) {
	if err := r.db.Create(p).Error; err != nil {
		return nil, err
	}
	return p, nil
}

// GetByID retrieves a project by ID
func (r *ProjectRepository) GetByID(id string) (*Project, error) {
	var p Project
	if err := r.db.Where("id = ?", id).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

// GetByUserID retrieves all projects for a user
func (r *ProjectRepository) GetByUserID(userID string) ([]Project, error) {
	var projects []Project
	if err := r.db.Where("user_id = ?", userID).Order("updated_at DESC, created_at DESC").Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

// ListAll returns all projects (ordered) -- used when auth is not required
func (r *ProjectRepository) ListAll() ([]Project, error) {
	var projects []Project
	if err := r.db.Order("updated_at DESC, created_at DESC").Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

// Update updates an existing project
func (r *ProjectRepository) Update(p *Project) (*Project, error) {
	if err := r.db.Save(p).Error; err != nil {
		return nil, err
	}
	return p, nil
}

// Delete deletes a project by ID
func (r *ProjectRepository) Delete(id string) error {
	return r.db.Delete(&Project{}, "id = ?", id).Error
}

// DeleteByUserID deletes all projects for a user
func (r *ProjectRepository) DeleteByUserID(userID string) error {
	return r.db.Delete(&Project{}, "user_id = ?", userID).Error
}
