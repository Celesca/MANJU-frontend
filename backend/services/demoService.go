package services

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"manju/backend/repository"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// =============================================================================
// Direct LLM helpers — call OpenAI / Ollama without the Python service
// =============================================================================

type directLLMResult struct {
	Response  string
	ModelUsed string
	Nodes     []string
}

// needsPythonWorkflow returns true when any node requires the Python workflow
// executor (RAG, Google Sheets, if-condition). Simple chat nodes are fine.
func needsPythonWorkflow(nodes []map[string]interface{}) bool {
	for _, node := range nodes {
		t, _ := node["type"].(string)
		if t == "rag-documents" || t == "google-sheets" || t == "if-condition" {
			return true
		}
	}
	return false
}

// findAIModelData returns the data map of the first ai-model node, or nil.
func findAIModelData(nodes []map[string]interface{}) map[string]interface{} {
	for _, node := range nodes {
		if t, _ := node["type"].(string); t == "ai-model" {
			if data, ok := node["data"].(map[string]interface{}); ok {
				return data
			}
		}
	}
	return nil
}

// buildChatMessages combines optional systemPrompt + history + current message
// into the OpenAI-compatible message array.
func buildChatMessages(systemPrompt string, history []map[string]interface{}, message string) []map[string]interface{} {
	msgs := make([]map[string]interface{}, 0, len(history)+2)
	if systemPrompt != "" {
		msgs = append(msgs, map[string]interface{}{"role": "system", "content": systemPrompt})
	}
	for _, h := range history {
		role, _ := h["role"].(string)
		content, _ := h["content"].(string)
		if role != "" && content != "" {
			msgs = append(msgs, map[string]interface{}{"role": role, "content": content})
		}
	}
	msgs = append(msgs, map[string]interface{}{"role": "user", "content": message})
	return msgs
}

// callOpenAIDirect posts to OpenAI /v1/chat/completions and returns the text reply.
func callOpenAIDirect(apiKey, model, systemPrompt string, history []map[string]interface{}, message string, temperature float64, maxTokens int) (string, error) {
	if model == "" {
		model = "gpt-4o-mini"
	}
	if temperature == 0 {
		temperature = 0.7
	}
	if maxTokens == 0 {
		maxTokens = 1000
	}
	payload := map[string]interface{}{
		"model":       model,
		"messages":    buildChatMessages(systemPrompt, history, message),
		"temperature": temperature,
		"max_tokens":  maxTokens,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("OpenAI request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenAI returned %d: %s", resp.StatusCode, respBody)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parse OpenAI response: %w", err)
	}
	choices, _ := result["choices"].([]interface{})
	if len(choices) == 0 {
		return "", fmt.Errorf("no choices in OpenAI response")
	}
	choice, _ := choices[0].(map[string]interface{})
	msg, _ := choice["message"].(map[string]interface{})
	content, _ := msg["content"].(string)
	return content, nil
}

// callOllamaDirect posts to Ollama /api/chat and returns the text reply.
func callOllamaDirect(ollamaURL, model, systemPrompt string, history []map[string]interface{}, message string) (string, error) {
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}
	if model == "" {
		model = "llama3.2"
	}
	payload := map[string]interface{}{
		"model":    model,
		"messages": buildChatMessages(systemPrompt, history, message),
		"stream":   false,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", ollamaURL+"/api/chat", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("Ollama request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Ollama returned %d: %s", resp.StatusCode, respBody)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parse Ollama response: %w", err)
	}
	msg, _ := result["message"].(map[string]interface{})
	content, _ := msg["content"].(string)
	return content, nil
}

// tryDirectLLMCall attempts to run a simple workflow entirely in Go.
//
// Returns:
//   - (result, true, nil)  — success, use this result
//   - (nil, true, err)     — provider was detected but call failed (return error to client)
//   - (nil, false, nil)    — workflow needs Python (RAG / Sheets / conditions / unknown provider)
func tryDirectLLMCall(nodes []map[string]interface{}, message string, history []map[string]interface{}, apiKey string) (*directLLMResult, bool, error) {
	if needsPythonWorkflow(nodes) {
		return nil, false, nil
	}
	aiData := findAIModelData(nodes)
	if aiData == nil {
		return nil, false, nil
	}

	provider, _ := aiData["provider"].(string)
	if provider != "openai" && provider != "ollama" {
		return nil, false, nil
	}

	modelName, _ := aiData["modelName"].(string)
	systemPrompt, _ := aiData["systemPrompt"].(string)
	temperature, _ := aiData["temperature"].(float64)
	maxTokensF, _ := aiData["maxTokens"].(float64)
	maxTokens := int(maxTokensF)

	var response string
	var err error

	switch provider {
	case "openai":
		if apiKey == "" {
			return nil, true, fmt.Errorf("OpenAI API key not configured. Add one in Settings or the AI Model node.")
		}
		response, err = callOpenAIDirect(apiKey, modelName, systemPrompt, history, message, temperature, maxTokens)
		if err != nil {
			return nil, true, err
		}
	case "ollama":
		ollamaURL, _ := aiData["ollamaUrl"].(string)
		response, err = callOllamaDirect(ollamaURL, modelName, systemPrompt, history, message)
		if err != nil {
			return nil, true, err
		}
	}

	displayModel := provider + "/" + modelName
	return &directLLMResult{
		Response:  response,
		ModelUsed: displayModel,
		Nodes:     []string{"text-input", "ai-model", "text-output"},
	}, true, nil
}

// SplitSentences splits text into sentence-sized chunks for client-side TTS pipeline.
var sentenceRe = regexp.MustCompile(`[^.!?।]+[.!?।]+`)

func SplitSentences(text string) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return []string{}
	}
	matches := sentenceRe.FindAllString(text, -1)
	if len(matches) == 0 {
		return []string{text}
	}
	// Collect remainder after last punctuation
	last := matches[len(matches)-1]
	idx := strings.LastIndex(text, last) + len(last)
	if idx < len(text) {
		rest := strings.TrimSpace(text[idx:])
		if rest != "" {
			matches = append(matches, rest)
		}
	}
	for i := range matches {
		matches[i] = strings.TrimSpace(matches[i])
	}
	return matches
}

// MakeCacheKey returns a short SHA-256 hex key for the given text + provider settings.
func MakeCacheKey(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p + "|"))
	}
	return fmt.Sprintf("%x", h.Sum(nil))[:24]
}

// DemoChatRequest represents the chat request to the AI service
type DemoChatRequest struct {
	Message             string                   `json:"message"`
	Workflow            WorkflowConfig           `json:"workflow"`
	ConversationHistory []map[string]interface{} `json:"conversation_history"`
	SessionID           string                   `json:"session_id,omitempty"`
	OpenAIAPIKey        string                   `json:"openai_api_key,omitempty"`
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

	// Inject userId and projectId into RAG nodes so AI executor can locate FAISS index
	// Also check for selectedApiKeyId in AI model nodes
	var selectedKeyID string
	for i, node := range nodes {
		nodeType, _ := node["type"].(string)

		if nodeType == "rag-documents" {
			nodeData, ok := node["data"].(map[string]interface{})
			if !ok {
				nodeData = map[string]interface{}{}
			}
			nodeData["userId"] = userIDStr.(string)
			nodeData["projectId"] = projectID
			nodes[i]["data"] = nodeData
		}

		// Check AI model nodes for selected API key
		if nodeType == "ai-model" {
			nodeData, ok := node["data"].(map[string]interface{})
			if ok {
				if keyID, exists := nodeData["selectedApiKeyId"].(string); exists && keyID != "" {
					selectedKeyID = keyID
				}
			}
		}
	}

	// Retrieve API key - prioritize:
	// 1. Specifically selected key in the workflow node
	// 2. User's designated "Default" key in the new system
	// 3. (Legacy) User's single encrypted_api_key field
	var userAPIKey string
	keyRepo := repository.NewUserAPIKeyRepository(repository.GetDB())

	if selectedKeyID != "" {
		// Use specifically selected key from workflow
		userAPIKey, _ = GetDecryptedAPIKey(keyRepo, selectedKeyID)
	}

	// If no specific key selected or failed to retrieve it, look for the user's default key in the new system
	if userAPIKey == "" {
		defaultKey, err := keyRepo.GetDefaultByUserID(userIDStr.(string))
		if err == nil && defaultKey != nil {
			userAPIKey, _ = DecryptAPIKey(defaultKey.EncryptedKey)
		}
	}

	// Last fallback: user's legacy single key field
	if userAPIKey == "" {
		userRepo := repository.New(repository.GetDB())
		user, err := userRepo.GetByID(userIDStr.(string))
		if err == nil && user != nil && user.EncryptedAPIKey != "" {
			userAPIKey, _ = DecryptAPIKey(user.EncryptedAPIKey)
		}
	}

	// Final fallback: inline openaiApiKey stored directly in any node's data
	// (covers keys entered in the VoiceOutput or AIModel node config panels)
	if userAPIKey == "" {
		for _, node := range nodes {
			if data, ok := node["data"].(map[string]interface{}); ok {
				if k, ok := data["openaiApiKey"].(string); ok && k != "" {
					userAPIKey = k
					break
				}
			}
		}
	}

	t0 := time.Now()

	// ---- Try direct LLM call (OpenAI / Ollama) bypassing Python ----
	if direct, handled, err := tryDirectLLMCall(nodes, body.Message, body.ConversationHistory, userAPIKey); handled {
		if err != nil {
			log.Printf("[ERROR] Direct LLM call failed: %v", err)
			return c.Status(http.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
		}
		ms := float64(time.Since(t0).Milliseconds())
		log.Printf("[MANJU_TIMING] /demo direct project=%s ms=%.1f model=%s", projectID, ms, direct.ModelUsed)
		return c.JSON(DemoChatResponse{
			Response:         direct.Response,
			ModelUsed:        direct.ModelUsed,
			ProcessingTimeMs: ms,
			NodesExecuted:    direct.Nodes,
		})
	}

	// ---- Fall back to Python AI service ----
	aiRequest := DemoChatRequest{
		Message: body.Message,
		Workflow: WorkflowConfig{
			Nodes:       nodes,
			Connections: connections,
		},
		ConversationHistory: body.ConversationHistory,
		SessionID:           body.SessionID,
		OpenAIAPIKey:        userAPIKey,
	}

	requestBody, err := json.Marshal(aiRequest)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build request"})
	}

	aiServiceURL := getAIServiceURL() + "/chat"
	log.Printf("[DEBUG] Calling AI service at: %s", aiServiceURL)
	client := &http.Client{Timeout: 60 * time.Second}

	req, err := http.NewRequest("POST", aiServiceURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[ERROR] AI service call failed: %v", err)
		return c.JSON(DemoChatResponse{
			Response:         "[Demo Mode] AI service is not available. Message received: " + body.Message,
			ModelUsed:        "mock",
			ProcessingTimeMs: 0,
			NodesExecuted:    []string{"text-input", "text-output"},
		})
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read AI response"})
	}

	if resp.StatusCode != http.StatusOK {
		var errorResp map[string]interface{}
		if err := json.Unmarshal(responseBody, &errorResp); err == nil {
			return c.Status(resp.StatusCode).JSON(errorResp)
		}
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "AI service error"})
	}

	var aiResponse DemoChatResponse
	if err := json.Unmarshal(responseBody, &aiResponse); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to parse AI response"})
	}

	roundTripMs := float64(time.Since(t0).Milliseconds())
	log.Printf("[MANJU_TIMING] /demo project=%s round_trip_ms=%.1f ai_processing_ms=%.1f model=%s nodes=%v",
		projectID, roundTripMs, aiResponse.ProcessingTimeMs, aiResponse.ModelUsed, aiResponse.NodesExecuted)

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

	req, err := http.NewRequest("POST", aiServiceURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
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
	TTSProvider  string `json:"tts_provider,omitempty"`   // "openai" | "qwen3"
	OpenAIVoice  string `json:"openai_voice,omitempty"`   // e.g. "alloy"
	OpenAIModel  string `json:"openai_model,omitempty"`   // e.g. "tts-1", "gpt-4o-audio-preview"
	ASRProvider  string `json:"asr_provider,omitempty"`   // "web-speech" | "typhoon"
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

	req, err := http.NewRequest("POST", aiServiceURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
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

		// Detect TTS provider + OpenAI voice/model from voice-output node data
		ttsProvider := "openai"
		openaiVoice := "alloy"
		openaiModel := "tts-1"
		for _, node := range nodes {
			if t, ok := node["type"].(string); ok && t == "voice-output" {
				if data, ok := node["data"].(map[string]interface{}); ok {
					if provider, ok := data["ttsProvider"].(string); ok && provider != "" {
						ttsProvider = provider
					}
					if voice, ok := data["voice"].(string); ok && voice != "" {
						openaiVoice = voice
					}
					if model, ok := data["openaiModel"].(string); ok && model != "" {
						openaiModel = model
					}
				}
				break
			}
		}

		// Detect ASR provider from voice-input node data
		asrProvider := "web-speech"
		for _, node := range nodes {
			if t, ok := node["type"].(string); ok && t == "voice-input" {
				if data, ok := node["data"].(map[string]interface{}); ok {
					if provider, ok := data["asrProvider"].(string); ok && provider != "" {
						asrProvider = provider
					}
				}
				break
			}
		}

		return c.JSON(WorkflowTypeResponse{
			InputType:    inputType,
			OutputType:   outputType,
			WorkflowType: inputType + "-to-" + outputType,
			HasRAG:       contains(nodeTypes, "rag-documents"),
			HasSheets:    contains(nodeTypes, "google-sheets"),
			HasCondition: contains(nodeTypes, "if-condition"),
			TTSProvider:  ttsProvider,
			OpenAIVoice:  openaiVoice,
			OpenAIModel:  openaiModel,
			ASRProvider:  asrProvider,
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

	// Python /workflow-type doesn't know about openaiModel/openaiVoice — enrich from node data
	if workflowTypeResponse.OpenAIVoice == "" || workflowTypeResponse.OpenAIModel == "" {
		for _, node := range nodes {
			if t, ok := node["type"].(string); ok && t == "voice-output" {
				if data, ok := node["data"].(map[string]interface{}); ok {
					if v, ok := data["voice"].(string); ok && v != "" {
						workflowTypeResponse.OpenAIVoice = v
					}
					if m, ok := data["openaiModel"].(string); ok && m != "" {
						workflowTypeResponse.OpenAIModel = m
					}
				}
				break
			}
		}
		if workflowTypeResponse.OpenAIVoice == "" {
			workflowTypeResponse.OpenAIVoice = "alloy"
		}
		if workflowTypeResponse.OpenAIModel == "" {
			workflowTypeResponse.OpenAIModel = "tts-1"
		}
	}

	// Enrich ASR provider from voice-input node data
	if workflowTypeResponse.ASRProvider == "" {
		for _, node := range nodes {
			if t, ok := node["type"].(string); ok && t == "voice-input" {
				if data, ok := node["data"].(map[string]interface{}); ok {
					if provider, ok := data["asrProvider"].(string); ok && provider != "" {
						workflowTypeResponse.ASRProvider = provider
					}
				}
				break
			}
		}
		if workflowTypeResponse.ASRProvider == "" {
			workflowTypeResponse.ASRProvider = "web-speech"
		}
	}

	return c.JSON(workflowTypeResponse)
}

// TTSRequest represents the request for TTS
type TTSRequest struct {
	Text  string `json:"text"`
	Voice string `json:"voice"`
	Model string `json:"model"`
}

// GenerateTTS calls OpenAI TTS directly and streams audio back to the frontend.
// It reads voice/model from the request body and resolves the API key from:
//  1. openaiApiKey stored in the project's voice-output node (user override)
//  2. The user's default saved API key
//  3. The legacy single encrypted key field
func GenerateTTS(c *fiber.Ctx, repo *repository.ProjectRepository) error {
	// Auth check
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	projectID := c.Params("id")
	if projectID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "project id required"})
	}

	project, err := repo.GetByID(projectID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}
	if project.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Parse request body (voice + model come from DemoPage)
	var body TTSRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	if body.Voice == "" {
		body.Voice = "alloy"
	}
	if body.Model == "" {
		body.Model = "tts-1"
	}

	// ---- Resolve API key ----
	// 1. Check voice-output node for an openaiApiKey override stored in the workflow
	var apiKeyOverride string
	var nodes []map[string]interface{}
	if err := json.Unmarshal(project.Nodes, &nodes); err == nil {
		for _, node := range nodes {
			if t, ok := node["type"].(string); ok && t == "voice-output" {
				if data, ok := node["data"].(map[string]interface{}); ok {
					if k, ok := data["openaiApiKey"].(string); ok && k != "" {
						apiKeyOverride = k
					}
				}
				break
			}
		}
	}

	apiKey := apiKeyOverride
	if apiKey == "" {
		// 2. User's default saved key
		keyRepo := repository.NewUserAPIKeyRepository(repository.GetDB())
		defaultKey, err := keyRepo.GetDefaultByUserID(userIDStr.(string))
		if err == nil && defaultKey != nil {
			apiKey, _ = DecryptAPIKey(defaultKey.EncryptedKey)
		}
	}
	if apiKey == "" {
		// 3. Legacy single key field
		userRepo := repository.New(repository.GetDB())
		u, err := userRepo.GetByID(userIDStr.(string))
		if err == nil && u != nil && u.EncryptedAPIKey != "" {
			apiKey, _ = DecryptAPIKey(u.EncryptedAPIKey)
		}
	}
	if apiKey == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "OpenAI API key not configured. Add one in Settings or the Voice Output node.",
		})
	}

	// ---- Call OpenAI TTS directly ----
	ttsPayload := map[string]interface{}{
		"model": body.Model,
		"voice": body.Voice,
		"input": body.Text,
	}
	ttsPayloadJSON, err := json.Marshal(ttsPayload)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build TTS request"})
	}

	openAIClient := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("POST", "https://api.openai.com/v1/audio/speech", bytes.NewBuffer(ttsPayloadJSON))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create TTS request"})
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := openAIClient.Do(req)
	if err != nil {
		log.Printf("[ERROR] OpenAI TTS call failed: %v", err)
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "Failed to reach OpenAI TTS"})
	}

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		log.Printf("[ERROR] OpenAI TTS returned %d: %s", resp.StatusCode, errBody)
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": string(errBody)})
	}

	c.Set("Content-Type", "audio/mpeg")
	c.Set("Content-Disposition", "attachment; filename=\"speech.mp3\"")
	return c.SendStream(resp.Body)
}
