package controllers

import (
	"manju/backend/config/database"
	"manju/backend/repository"
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

// APIKeyController handles API key related HTTP requests
type APIKeyController struct {
	repo *repository.UserAPIKeyRepository
}

// NewAPIKeyController creates a new controller
func NewAPIKeyController() *APIKeyController {
	repo := repository.NewUserAPIKeyRepository(database.Database)
	return &APIKeyController{repo: repo}
}

func (c *APIKeyController) ListAPIKeys(ctx *fiber.Ctx) error {
	return services.ListAPIKeys(ctx, c.repo)
}

func (c *APIKeyController) AddAPIKey(ctx *fiber.Ctx) error {
	return services.AddAPIKey(ctx, c.repo)
}

func (c *APIKeyController) DeleteAPIKey(ctx *fiber.Ctx) error {
	return services.DeleteAPIKey(ctx, c.repo)
}

func (c *APIKeyController) SetDefaultAPIKey(ctx *fiber.Ctx) error {
	return services.SetDefaultAPIKey(ctx, c.repo)
}
