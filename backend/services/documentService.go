package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"manju/backend/repository"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// DocumentInfo represents uploaded document metadata
type DocumentInfo struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	Size       int64     `json:"size"`
	UploadedAt time.Time `json:"uploadedAt"`
	Status     string    `json:"status"`
	FilePath   string    `json:"filePath,omitempty"`
}

// getDocumentsStoragePath returns the base path for document storage
func getDocumentsStoragePath() string {
	path := os.Getenv("DOCUMENTS_STORAGE_PATH")
	if path == "" {
		path = "./uploads/documents"
	}
	return path
}

// ensureUserDocumentDir creates the user-specific document directory
func ensureUserDocumentDir(userID, projectID string) (string, error) {
	basePath := getDocumentsStoragePath()
	userPath := filepath.Join(basePath, userID, projectID)

	if err := os.MkdirAll(userPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create document directory: %w", err)
	}

	return userPath, nil
}

// triggerEmbedding calls the AI service to embed documents
func triggerEmbedding(userID, projectID, documentsPath string) error {
	aiServiceURL := getAIServiceURL()

	// Get absolute path
	absPath, err := filepath.Abs(documentsPath)
	if err != nil {
		return err
	}

	// Create request body
	reqBody := map[string]string{
		"documents_path": absPath,
		"user_id":        userID,
		"project_id":     projectID,
	}
	jsonBody, _ := json.Marshal(reqBody)

	// Make request to AI service
	resp, err := http.Post(
		aiServiceURL+"/embed-documents",
		"application/json",
		bytes.NewBuffer(jsonBody),
	)
	if err != nil {
		return fmt.Errorf("failed to call AI service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AI service error: %s", string(body))
	}

	return nil
}

// EmbedProjectDocuments triggers embedding for all documents in a project
func EmbedProjectDocuments(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get project ID from params
	projectID := c.Params("id")
	if projectID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "project id required"})
	}

	// Verify project exists and belongs to user
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Get documents path
	docDir, err := ensureUserDocumentDir(userIDStr.(string), projectID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Trigger embedding
	if err := triggerEmbedding(userIDStr.(string), projectID, docDir); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":   "embedding failed",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Documents embedded successfully",
	})
}

// UploadDocument handles document upload for a project
func UploadDocument(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get project ID from params
	projectID := c.Params("id")
	if projectID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "project id required"})
	}

	// Verify project exists and belongs to user
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Get the uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "no file uploaded"})
	}

	// Get document ID from form (or generate new one)
	documentID := c.FormValue("documentId")
	if documentID == "" {
		documentID = fmt.Sprintf("doc-%s", uuid.New().String()[:8])
	}

	// Validate file type
	ext := filepath.Ext(file.Filename)
	allowedExts := map[string]bool{".pdf": true, ".docx": true, ".txt": true, ".doc": true}
	if !allowedExts[ext] {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "unsupported file type"})
	}

	// Create user document directory
	docDir, err := ensureUserDocumentDir(userIDStr.(string), projectID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Create unique filename
	safeFilename := fmt.Sprintf("%s_%s%s", documentID, time.Now().Format("20060102150405"), ext)
	filePath := filepath.Join(docDir, safeFilename)

	// Save the file
	if err := c.SaveFile(file, filePath); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save file"})
	}

	// Create document info
	docInfo := DocumentInfo{
		ID:         documentID,
		Name:       file.Filename,
		Type:       ext[1:], // Remove the dot
		Size:       file.Size,
		UploadedAt: time.Now(),
		Status:     "ready",
		FilePath:   filePath,
	}

	// Update project's document list in nodes
	if err := updateProjectDocuments(repo, project, docInfo, "add"); err != nil {
		// Clean up uploaded file on error
		os.Remove(filePath)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update project"})
	}

	return c.Status(http.StatusCreated).JSON(docInfo)
}

// DeleteDocument handles document deletion for a project
func DeleteDocument(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get project ID and document ID from params
	projectID := c.Params("id")
	documentID := c.Params("docId")
	if projectID == "" || documentID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "project id and document id required"})
	}

	// Verify project exists and belongs to user
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Find and delete the file
	docDir, _ := ensureUserDocumentDir(userIDStr.(string), projectID)
	files, _ := os.ReadDir(docDir)
	for _, f := range files {
		if !f.IsDir() && len(f.Name()) > len(documentID) && f.Name()[:len(documentID)] == documentID {
			os.Remove(filepath.Join(docDir, f.Name()))
			break
		}
	}

	// Update project's document list
	updateProjectDocuments(repo, project, DocumentInfo{ID: documentID}, "remove")

	return c.JSON(fiber.Map{"success": true, "message": "document deleted"})
}

// ListDocuments lists all documents for a project
func ListDocuments(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get project ID from params
	projectID := c.Params("id")
	if projectID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "project id required"})
	}

	// Verify project exists and belongs to user
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Get document directory
	docDir, _ := ensureUserDocumentDir(userIDStr.(string), projectID)

	// List files
	files, err := os.ReadDir(docDir)
	if err != nil {
		return c.JSON([]DocumentInfo{})
	}

	documents := make([]DocumentInfo, 0)
	for _, f := range files {
		if !f.IsDir() {
			info, _ := f.Info()
			ext := filepath.Ext(f.Name())
			documents = append(documents, DocumentInfo{
				ID:         f.Name()[:len(f.Name())-len(ext)],
				Name:       f.Name(),
				Type:       ext[1:],
				Size:       info.Size(),
				UploadedAt: info.ModTime(),
				Status:     "ready",
			})
		}
	}

	return c.JSON(documents)
}

// GetDocumentFile serves a document file for the AI service
func GetDocumentFile(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get project ID and document ID from params
	projectID := c.Params("id")
	documentID := c.Params("docId")
	if projectID == "" || documentID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "project id and document id required"})
	}

	// Verify project exists and belongs to user
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Find the file
	docDir, _ := ensureUserDocumentDir(userIDStr.(string), projectID)
	files, _ := os.ReadDir(docDir)
	for _, f := range files {
		if !f.IsDir() && len(f.Name()) > len(documentID) && f.Name()[:len(documentID)] == documentID {
			return c.SendFile(filepath.Join(docDir, f.Name()))
		}
	}

	return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "document not found"})
}

// GetProjectDocumentsPath returns the path to project documents (for AI service)
func GetProjectDocumentsPath(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get project ID from params
	projectID := c.Params("id")
	if projectID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "project id required"})
	}

	// Verify project exists and belongs to user
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Get document directory path
	docDir, _ := ensureUserDocumentDir(userIDStr.(string), projectID)

	// Get absolute path
	absPath, _ := filepath.Abs(docDir)

	return c.JSON(fiber.Map{
		"path":      absPath,
		"projectId": projectID,
		"userId":    userIDStr,
	})
}

// updateProjectDocuments updates the document list in the project's RAG node
func updateProjectDocuments(repo *repository.ProjectRepository, project *repository.Project, doc DocumentInfo, action string) error {
	// Parse existing nodes
	var nodes []map[string]interface{}
	if err := json.Unmarshal(project.Nodes, &nodes); err != nil {
		nodes = []map[string]interface{}{}
	}

	// Find RAG documents node and update its data
	for i, node := range nodes {
		if nodeType, ok := node["type"].(string); ok && nodeType == "rag-documents" {
			nodeData, ok := node["data"].(map[string]interface{})
			if !ok {
				nodeData = map[string]interface{}{}
			}

			// Get existing documents
			var documents []map[string]interface{}
			if existingDocs, ok := nodeData["documents"].([]interface{}); ok {
				for _, d := range existingDocs {
					if docMap, ok := d.(map[string]interface{}); ok {
						documents = append(documents, docMap)
					}
				}
			}

			if action == "add" {
				// Add new document
				documents = append(documents, map[string]interface{}{
					"id":         doc.ID,
					"name":       doc.Name,
					"type":       doc.Type,
					"size":       doc.Size,
					"uploadedAt": doc.UploadedAt.Format(time.RFC3339),
					"status":     doc.Status,
				})
			} else if action == "remove" {
				// Remove document
				newDocs := make([]map[string]interface{}, 0)
				for _, d := range documents {
					if id, ok := d["id"].(string); ok && id != doc.ID {
						newDocs = append(newDocs, d)
					}
				}
				documents = newDocs
			}

			nodeData["documents"] = documents
			nodes[i]["data"] = nodeData
			break
		}
	}

	// Marshal and update
	nodesJSON, err := json.Marshal(nodes)
	if err != nil {
		return err
	}

	project.Nodes = nodesJSON
	_, err = repo.Update(project)
	return err
}

// ProxyDocumentToAI proxies document to AI service for processing
func ProxyDocumentToAI(userID, projectID string) (string, error) {
	basePath := getDocumentsStoragePath()
	docPath := filepath.Join(basePath, userID, projectID)
	absPath, err := filepath.Abs(docPath)
	if err != nil {
		return "", err
	}
	return absPath, nil
}

// CopyDocumentContent reads document content (for text files)
func CopyDocumentContent(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

	return string(content), nil
}
