package routes

import (
	"manju/backend/config/database"
	"manju/backend/controllers"
	"manju/backend/repository"

	"github.com/gofiber/fiber/v2"
)

func UserRoutes(app fiber.Router) {
	repo := repository.New(database.Database)
	ctrl := controllers.NewUserController(repo)

	router := app.Group("/users")
	router.Post("/", ctrl.CreateUser)
	router.Get("/", ctrl.ListUsers)
	router.Get("/:id", ctrl.GetUser)
	router.Put("/:id", ctrl.UpdateUser)
	router.Delete("/:id", ctrl.DeleteUser)
}
