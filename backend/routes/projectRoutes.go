package routes

import (
	"manju/backend/config/database"
	"manju/backend/controllers"
	"manju/backend/repository"

	"github.com/gofiber/fiber/v2"
)

func ProjectRoutes(app fiber.Router) {
	repo := repository.NewProject(database.Database)
	ctrl := controllers.NewProjectController(repo)
	demoCtrl := controllers.NewDemoController(repo)
	docCtrl := controllers.NewDocumentController(repo)

	router := app.Group("/projects")
	router.Post("/", ctrl.CreateProject)
	router.Get("/", ctrl.ListProjects)
	router.Get("/:id", ctrl.GetProject)
	router.Put("/:id", ctrl.UpdateProject)
	router.Delete("/:id", ctrl.DeleteProject)

	// Demo and validation endpoints
	router.Post("/:id/demo", demoCtrl.DemoProject)
	router.Post("/:id/validate", demoCtrl.ValidateWorkflow)
	router.Get("/:id/workflow-type", demoCtrl.GetWorkflowType)

	// Document management endpoints
	router.Post("/:id/documents", docCtrl.UploadDocument)
	router.Get("/:id/documents", docCtrl.ListDocuments)
	router.Delete("/:id/documents/:docId", docCtrl.DeleteDocument)
	router.Get("/:id/documents/:docId/file", docCtrl.GetDocumentFile)
	router.Get("/:id/documents-path", docCtrl.GetProjectDocumentsPath)
	router.Post("/:id/documents/embed", docCtrl.EmbedDocuments)
}
