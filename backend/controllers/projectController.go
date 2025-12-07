package controllers

import (
	"manju/backend/repository"
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

type ProjectController struct {
	repo *repository.ProjectRepository
}

func NewProjectController(repo *repository.ProjectRepository) *ProjectController {
	return &ProjectController{repo: repo}
}

func (pc *ProjectController) CreateProject(c *fiber.Ctx) error {
	return services.CreateProject(c, pc.repo)
}

func (pc *ProjectController) ListProjects(c *fiber.Ctx) error {
	return services.ListProjects(c, pc.repo)
}

func (pc *ProjectController) GetProject(c *fiber.Ctx) error {
	return services.GetProject(c, pc.repo)
}

func (pc *ProjectController) UpdateProject(c *fiber.Ctx) error {
	return services.UpdateProject(c, pc.repo)
}

func (pc *ProjectController) DeleteProject(c *fiber.Ctx) error {
	return services.DeleteProject(c, pc.repo)
}
