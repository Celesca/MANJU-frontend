package controllers

import (
	"manju/backend/repository"
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

// DocumentController handles document-related HTTP requests
type DocumentController struct {
	repo *repository.ProjectRepository
}

// NewDocumentController creates a new DocumentController
func NewDocumentController(repo *repository.ProjectRepository) *DocumentController {
	return &DocumentController{repo}
}

// UploadDocument handles POST /projects/:id/documents
func (ctrl *DocumentController) UploadDocument(c *fiber.Ctx) error {
	return services.UploadDocument(c, ctrl.repo)
}

// DeleteDocument handles DELETE /projects/:id/documents/:docId
func (ctrl *DocumentController) DeleteDocument(c *fiber.Ctx) error {
	return services.DeleteDocument(c, ctrl.repo)
}

// ListDocuments handles GET /projects/:id/documents
func (ctrl *DocumentController) ListDocuments(c *fiber.Ctx) error {
	return services.ListDocuments(c, ctrl.repo)
}

// GetDocumentFile handles GET /projects/:id/documents/:docId/file
func (ctrl *DocumentController) GetDocumentFile(c *fiber.Ctx) error {
	return services.GetDocumentFile(c, ctrl.repo)
}

// GetProjectDocumentsPath handles GET /projects/:id/documents-path
func (ctrl *DocumentController) GetProjectDocumentsPath(c *fiber.Ctx) error {
	return services.GetProjectDocumentsPath(c, ctrl.repo)
}

// EmbedDocuments handles POST /projects/:id/documents/embed
func (ctrl *DocumentController) EmbedDocuments(c *fiber.Ctx) error {
	return services.EmbedProjectDocuments(c, ctrl.repo)
}
