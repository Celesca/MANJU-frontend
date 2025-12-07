package controllers

import (
	"manju/backend/repository"
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

// DemoController handles demo-related HTTP requests
type DemoController struct {
	repo *repository.ProjectRepository
}

// NewDemoController creates a new DemoController
func NewDemoController(repo *repository.ProjectRepository) *DemoController {
	return &DemoController{repo}
}

// DemoProject handles POST /projects/:id/demo
func (ctrl *DemoController) DemoProject(c *fiber.Ctx) error {
	return services.DemoProject(c, ctrl.repo)
}

// ValidateWorkflow handles POST /projects/:id/validate
func (ctrl *DemoController) ValidateWorkflow(c *fiber.Ctx) error {
	return services.ValidateWorkflow(c, ctrl.repo)
}

// GetWorkflowType handles GET /projects/:id/workflow-type
func (ctrl *DemoController) GetWorkflowType(c *fiber.Ctx) error {
	return services.GetWorkflowType(c, ctrl.repo)
}
