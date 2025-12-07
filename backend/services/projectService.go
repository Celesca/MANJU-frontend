package services

import (
	"encoding/json"
	"manju/backend/repository"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// CreateProjectPayload represents the request body for creating a project
type CreateProjectPayload struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Nodes       interface{} `json:"nodes"`
	Connections interface{} `json:"connections"`
}

// UpdateProjectPayload represents the request body for updating a project
type UpdateProjectPayload struct {
	Name        *string     `json:"name,omitempty"`
	Description *string     `json:"description,omitempty"`
	Nodes       interface{} `json:"nodes,omitempty"`
	Connections interface{} `json:"connections,omitempty"`
	Status      *string     `json:"status,omitempty"`
}

func CreateProject(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context (set by auth middleware)
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid user id"})
	}

	var body CreateProjectPayload
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	if body.Name == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	project := repository.Project{
		UserID:      userID,
		Name:        body.Name,
		Description: body.Description,
		Status:      "draft",
	}

	// Convert nodes to JSON
	if body.Nodes != nil {
		nodesJSON, err := json.Marshal(body.Nodes)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid nodes"})
		}
		project.Nodes = datatypes.JSON(nodesJSON)
	} else {
		project.Nodes = datatypes.JSON([]byte("[]"))
	}

	// Convert connections to JSON
	if body.Connections != nil {
		connectionsJSON, err := json.Marshal(body.Connections)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid connections"})
		}
		project.Connections = datatypes.JSON(connectionsJSON)
	} else {
		project.Connections = datatypes.JSON([]byte("[]"))
	}

	created, err := repo.Create(&project)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(http.StatusCreated).JSON(created)
}

func ListProjects(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context if available; if not, return all projects (no auth)
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		projects, err := repo.ListAll()
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(projects)
	}

	projects, err := repo.GetByUserID(userIDStr.(string))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(projects)
}

func GetProject(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	id := c.Params("id")

	// Get user ID from context for authorization
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	project, err := repo.GetByID(id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	// Verify ownership
	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}

	return c.JSON(project)
}

func UpdateProject(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	id := c.Params("id")

	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get existing project
	project, err := repo.GetByID(id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	// Verify ownership
	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}

	var body UpdateProjectPayload
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	// Update fields
	if body.Name != nil {
		project.Name = *body.Name
	}
	if body.Description != nil {
		project.Description = *body.Description
	}
	if body.Status != nil {
		project.Status = *body.Status
	}
	if body.Nodes != nil {
		nodesJSON, err := json.Marshal(body.Nodes)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid nodes"})
		}
		project.Nodes = datatypes.JSON(nodesJSON)
	}
	if body.Connections != nil {
		connectionsJSON, err := json.Marshal(body.Connections)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid connections"})
		}
		project.Connections = datatypes.JSON(connectionsJSON)
	}

	updated, err := repo.Update(project)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(updated)
}

func DeleteProject(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	id := c.Params("id")

	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get existing project to verify ownership
	project, err := repo.GetByID(id)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	// Verify ownership
	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}

	if err := repo.Delete(id); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "project deleted"})
}
