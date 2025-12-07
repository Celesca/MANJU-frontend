package controllers

import (
	"manju/backend/repository"
	"manju/backend/services"

	"github.com/gofiber/fiber/v2"
)

type UserController struct {
	repo *repository.UserRepository
}

func NewUserController(repo *repository.UserRepository) *UserController {
	return &UserController{repo: repo}
}

func (uc *UserController) CreateUser(c *fiber.Ctx) error {
	return services.CreateUser(c, uc.repo)
}

func (uc *UserController) ListUsers(c *fiber.Ctx) error {
	return services.ListUsers(c, uc.repo)
}

func (uc *UserController) GetUser(c *fiber.Ctx) error {
	return services.GetUser(c, uc.repo)
}

func (uc *UserController) UpdateUser(c *fiber.Ctx) error {
	return services.UpdateUser(c, uc.repo)
}

func (uc *UserController) DeleteUser(c *fiber.Ctx) error {
	return services.DeleteUser(c, uc.repo)
}
