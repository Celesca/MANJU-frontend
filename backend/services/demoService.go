package services

import (
	"bytes"
	"encoding/json"
	"io"
	"manju/backend/repository"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

// DemoChatRequest represents the chat request to the AI service
type DemoChatRequest struct {
	Message             string                   `json:"message"`
	Workflow            WorkflowConfig           `json:"workflow"`
	ConversationHistory []map[string]interface{} `json:"conversation_history"`
	SessionID           string                   `json:"session_id,omitempty"`
}

// WorkflowConfig represents the workflow configuration
type WorkflowConfig struct {
	Nodes       []map[string]interface{} `json:"nodes"`
	Connections []map[string]interface{} `json:"connections"`
}

// DemoChatResponse represents the response from the AI service
type DemoChatResponse struct {
	Response         string   `json:"response"`
	ModelUsed        string   `json:"model_used,omitempty"`
	ProcessingTimeMs float64  `json:"processing_time_ms"`
	NodesExecuted    []string `json:"nodes_executed"`
}

// DemoRequest is the request body from the frontend
type DemoRequest struct {
	Message             string                   `json:"message"`
	ConversationHistory []map[string]interface{} `json:"conversation_history"`
	SessionID           string                   `json:"session_id,omitempty"`
}

// getAIServiceURL returns the AI service URL from environment or default
func getAIServiceURL() string {
	url := os.Getenv("AI_SERVICE_URL")
	if url == "" {
		url = "http://localhost:8000"
	}
	return url
}

// DemoProject handles the demo chat request for a project
func DemoProject(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Get user ID from context (set by auth middleware)
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get project ID from params
	projectID := c.Params("id")
	if projectID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "project id required"})
	}

	// Get project from database
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	// Verify ownership
	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Parse request body
	var body DemoRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	if body.Message == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "message is required"})
	}

	// Parse nodes and connections from project
	var nodes []map[string]interface{}
	var connections []map[string]interface{}

	if err := json.Unmarshal(project.Nodes, &nodes); err != nil {
		nodes = []map[string]interface{}{}
	}
	if err := json.Unmarshal(project.Connections, &connections); err != nil {
		connections = []map[string]interface{}{}
	}

	// Build request to AI service
	aiRequest := DemoChatRequest{
		Message: body.Message,
		Workflow: WorkflowConfig{
			Nodes:       nodes,
			Connections: connections,
		},
		ConversationHistory: body.ConversationHistory,
		SessionID:           body.SessionID,
	}

	requestBody, err := json.Marshal(aiRequest)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build request"})
	}

	// Call AI service
	aiServiceURL := getAIServiceURL() + "/chat"
	client := &http.Client{Timeout: 60 * time.Second}

	resp, err := client.Post(aiServiceURL, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		// If AI service is not available, return a mock response
		return c.JSON(DemoChatResponse{
			Response:         "[Demo Mode] AI service is not available. Message received: " + body.Message,
			ModelUsed:        "mock",
			ProcessingTimeMs: 0,
			NodesExecuted:    []string{"text-input", "text-output"},
		})
	}
	defer resp.Body.Close()

	// Read response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read AI response"})
	}

	// Check for error response
	if resp.StatusCode != http.StatusOK {
		var errorResp map[string]interface{}
		if err := json.Unmarshal(responseBody, &errorResp); err == nil {
			return c.Status(resp.StatusCode).JSON(errorResp)
		}
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "AI service error"})
	}

	// Parse and return response
	var aiResponse DemoChatResponse
	if err := json.Unmarshal(responseBody, &aiResponse); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to parse AI response"})
	}

	return c.JSON(aiResponse)
}

// ValidateWorkflow validates a project's workflow configuration
func ValidateWorkflow(c *fiber.Ctx, repo *repository.ProjectRepository) error {
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

	// Get project from database
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	// Verify ownership
	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Parse nodes and connections
	var nodes []map[string]interface{}
	var connections []map[string]interface{}

	if err := json.Unmarshal(project.Nodes, &nodes); err != nil {
		nodes = []map[string]interface{}{}
	}
	if err := json.Unmarshal(project.Connections, &connections); err != nil {
		connections = []map[string]interface{}{}
	}

	// Build request to AI service
	workflow := WorkflowConfig{
		Nodes:       nodes,
		Connections: connections,
	}

	requestBody, err := json.Marshal(workflow)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build request"})
	}

	// Call AI service validate endpoint
	aiServiceURL := getAIServiceURL() + "/validate"
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Post(aiServiceURL, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		// If AI service is not available, do basic validation locally
		nodeTypes := make([]string, 0)
		for _, node := range nodes {
			if t, ok := node["type"].(string); ok {
				nodeTypes = append(nodeTypes, t)
			}
		}

		hasInput := contains(nodeTypes, "text-input") || contains(nodeTypes, "voice-input")
		hasOutput := contains(nodeTypes, "text-output") || contains(nodeTypes, "voice-output")
		hasAI := contains(nodeTypes, "ai-model")

		issues := []string{}
		if !hasInput {
			issues = append(issues, "Workflow needs an input node")
		}
		if !hasOutput {
			issues = append(issues, "Workflow needs an output node")
		}
		if !hasAI {
			issues = append(issues, "Workflow needs an AI model node")
		}

		return c.JSON(fiber.Map{
			"valid":            len(issues) == 0,
			"issues":           issues,
			"node_count":       len(nodes),
			"connection_count": len(connections),
			"node_types":       nodeTypes,
		})
	}
	defer resp.Body.Close()

	// Read and return response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read response"})
	}

	var validationResponse map[string]interface{}
	if err := json.Unmarshal(responseBody, &validationResponse); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to parse response"})
	}

	return c.JSON(validationResponse)
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// WorkflowTypeResponse represents the workflow type detection response
type WorkflowTypeResponse struct {
	InputType    string `json:"input_type"`
	OutputType   string `json:"output_type"`
	WorkflowType string `json:"workflow_type"`
	HasRAG       bool   `json:"has_rag"`
	HasSheets    bool   `json:"has_sheets"`
	HasCondition bool   `json:"has_condition"`
}

// GetWorkflowType detects the workflow input/output modalities
func GetWorkflowType(c *fiber.Ctx, repo *repository.ProjectRepository) error {
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

	// Get project from database
	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	// Verify ownership
	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Parse nodes
	var nodes []map[string]interface{}
	if err := json.Unmarshal(project.Nodes, &nodes); err != nil {
		nodes = []map[string]interface{}{}
	}

	// Build request to AI service
	var connections []map[string]interface{}
	if err := json.Unmarshal(project.Connections, &connections); err != nil {
		connections = []map[string]interface{}{}
	}

	workflow := WorkflowConfig{
		Nodes:       nodes,
		Connections: connections,
	}

	requestBody, err := json.Marshal(workflow)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build request"})
	}

	// Call AI service workflow-type endpoint
	aiServiceURL := getAIServiceURL() + "/workflow-type"
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Post(aiServiceURL, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		// If AI service is not available, detect locally
		nodeTypes := make([]string, 0)
		for _, node := range nodes {
			if t, ok := node["type"].(string); ok {
				nodeTypes = append(nodeTypes, t)
			}
		}

		hasVoiceInput := contains(nodeTypes, "voice-input")
		hasVoiceOutput := contains(nodeTypes, "voice-output")

		inputType := "text"
		if hasVoiceInput {
			inputType = "voice"
		}

		outputType := "text"
		if hasVoiceOutput {
			outputType = "voice"
		}

		return c.JSON(WorkflowTypeResponse{
			InputType:    inputType,
			OutputType:   outputType,
			WorkflowType: inputType + "-to-" + outputType,
			HasRAG:       contains(nodeTypes, "rag-documents"),
			HasSheets:    contains(nodeTypes, "google-sheets"),
			HasCondition: contains(nodeTypes, "if-condition"),
		})
	}
	defer resp.Body.Close()

	// Read and return response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read response"})
	}

	var workflowTypeResponse WorkflowTypeResponse
	if err := json.Unmarshal(responseBody, &workflowTypeResponse); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to parse response"})
	}

	return c.JSON(workflowTypeResponse)
}
