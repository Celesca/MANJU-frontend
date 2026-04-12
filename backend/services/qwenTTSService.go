package services

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"manju/backend/repository"
	"mime/multipart"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

// =============================================================================
// Helpers
// =============================================================================

// getQwenTTSServiceURL returns the AI service base URL (main.py) for Qwen TTS proxy.
// The main AI service exposes /talk, /voice-references/* and /qwen-tts/health.
func getQwenTTSServiceURL() string {
	url := os.Getenv("AI_SERVICE_URL")
	if url == "" {
		url = "http://localhost:8000"
	}
	return url
}

// =============================================================================
// Request / Response types
// =============================================================================

// TalkRequest is the frontend request body for the /talk endpoint.
type TalkRequest struct {
	Message             string                   `json:"message"`
	ConversationHistory []map[string]interface{} `json:"conversation_history"`
	SessionID           string                   `json:"session_id,omitempty"`
	// TTS provider: "openai" | "qwen3"
	TTSProvider string `json:"tts_provider,omitempty"`
	// OpenAI TTS settings
	OpenAIVoice string `json:"openai_voice,omitempty"`
	OpenAIModel string `json:"openai_model,omitempty"`
	// Qwen TTS settings
	TTSMode          string `json:"tts_mode"`           // "custom" | "voice-clone" | "voice-design"
	VoiceName        string `json:"voice_name"`         // For custom preset voices
	Instruction      string `json:"instruction"`        // Style instruction for custom voice
	VoiceDescription string `json:"voice_description"`  // For voice-design mode
	ReferenceVoiceID string `json:"reference_voice_id"` // Cached ref voice ID for clone mode
	UseFastMode      bool   `json:"use_fast_mode"`
}

// VoiceReferenceResponse represents a cached voice reference.
type VoiceReferenceResponse struct {
	ID            string `json:"id"`
	Filename      string `json:"filename"`
	RefTranscript string `json:"ref_transcript,omitempty"`
	CreatedAt     string `json:"created_at"`
}

// =============================================================================
// Talk — Workflow → Qwen TTS (audio stream)
// =============================================================================

// Talk proxies a chat-to-voice request to the AI backend /talk endpoint.
func Talk(c *fiber.Ctx, repo *repository.ProjectRepository) error {
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

	// Parse frontend body
	var body TalkRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	if body.Message == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "message is required"})
	}

	// Parse workflow from project
	var nodes []map[string]interface{}
	var connections []map[string]interface{}
	if err := json.Unmarshal(project.Nodes, &nodes); err != nil {
		nodes = []map[string]interface{}{}
	}
	if err := json.Unmarshal(project.Connections, &connections); err != nil {
		connections = []map[string]interface{}{}
	}

	// Extract voice-output node data to populate TTS settings if not overridden by frontend
	for _, node := range nodes {
		nodeType, _ := node["type"].(string)
		if nodeType == "voice-output" {
			nodeData, ok := node["data"].(map[string]interface{})
			if ok {
				// TTS provider
				if body.TTSProvider == "" {
					if p, exists := nodeData["ttsProvider"].(string); exists && p != "" {
						body.TTSProvider = p
					}
				}
				// OpenAI voice + model
				if body.OpenAIVoice == "" {
					if v, exists := nodeData["voice"].(string); exists && v != "" {
						body.OpenAIVoice = v
					}
				}
				if body.OpenAIModel == "" {
					if m, exists := nodeData["openaiModel"].(string); exists && m != "" {
						body.OpenAIModel = m
					}
				}
				// Qwen TTS settings
				if body.TTSMode == "" {
					if mode, exists := nodeData["ttsMode"].(string); exists && mode != "" {
						body.TTSMode = mode
					}
				}
				if body.VoiceName == "" {
					if vn, exists := nodeData["voiceName"].(string); exists && vn != "" {
						body.VoiceName = vn
					}
				}
				if body.Instruction == "" {
					if instr, exists := nodeData["instruction"].(string); exists && instr != "" {
						body.Instruction = instr
					}
				}
				if body.VoiceDescription == "" {
					if vd, exists := nodeData["voiceDescription"].(string); exists && vd != "" {
						body.VoiceDescription = vd
					}
				}
				if body.ReferenceVoiceID == "" {
					if rv, exists := nodeData["referenceVoiceId"].(string); exists && rv != "" {
						body.ReferenceVoiceID = rv
					}
				}
			}
			break
		}
	}

	// Defaults
	if body.TTSProvider == "" {
		body.TTSProvider = "qwen3"
	}
	if body.OpenAIVoice == "" {
		body.OpenAIVoice = "alloy"
	}
	if body.OpenAIModel == "" {
		body.OpenAIModel = "tts-1"
	}
	if body.TTSMode == "" {
		body.TTSMode = "custom"
	}
	if body.VoiceName == "" {
		body.VoiceName = "serena"
	}

	// Inject userId/projectId into RAG nodes
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
	}

	// Retrieve API key (same logic as DemoProject)
	var userAPIKey string
	keyRepo := repository.NewUserAPIKeyRepository(repository.GetDB())

	// Try to find selected key from AI model nodes
	var selectedKeyID string
	for _, node := range nodes {
		nodeType, _ := node["type"].(string)
		if nodeType == "ai-model" {
			nodeData, ok := node["data"].(map[string]interface{})
			if ok {
				if keyID, exists := nodeData["selectedApiKeyId"].(string); exists && keyID != "" {
					selectedKeyID = keyID
				}
			}
		}
	}

	if selectedKeyID != "" {
		userAPIKey, _ = GetDecryptedAPIKey(keyRepo, selectedKeyID)
	}
	if userAPIKey == "" {
		defaultKey, err := keyRepo.GetDefaultByUserID(userIDStr.(string))
		if err == nil && defaultKey != nil {
			userAPIKey, _ = DecryptAPIKey(defaultKey.EncryptedKey)
		}
	}
	if userAPIKey == "" {
		userRepo := repository.New(repository.GetDB())
		user, err := userRepo.GetByID(userIDStr.(string))
		if err == nil && user != nil && user.EncryptedAPIKey != "" {
			userAPIKey, _ = DecryptAPIKey(user.EncryptedAPIKey)
		}
	}
	// Final fallback: inline openaiApiKey stored in any node's data
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

	t0Talk := time.Now()

	// ---- Try direct LLM call (OpenAI / Ollama) bypassing Python ----
	if direct, handled, err := tryDirectLLMCall(nodes, body.Message, body.ConversationHistory, userAPIKey); handled {
		if err != nil {
			log.Printf("[ERROR] Direct LLM /talk failed: %v", err)
			return c.Status(http.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
		}
		ms := float64(time.Since(t0Talk).Milliseconds())
		sentences := SplitSentences(direct.Response)
		cacheKey := MakeCacheKey(direct.Response, body.TTSProvider, body.OpenAIVoice, body.OpenAIModel)
		log.Printf("[MANJU_TIMING] /talk direct project=%s ms=%.1f model=%s", c.Params("id"), ms, direct.ModelUsed)
		return c.JSON(fiber.Map{
			"text_response":      direct.Response,
			"sentences":          sentences,
			"cache_key":          cacheKey,
			"model_used":         direct.ModelUsed,
			"processing_time_ms": ms,
			"t_llm_ms":           ms,
			"t_ttft_ms":          ms,
			"t_e2e_ms":           ms,
			"nodes_executed":     direct.Nodes,
			"tts_provider":       body.TTSProvider,
			"tts_settings": fiber.Map{
				"tts_mode":           body.TTSMode,
				"voice_name":         body.VoiceName,
				"instruction":        body.Instruction,
				"voice_description":  body.VoiceDescription,
				"reference_voice_id": body.ReferenceVoiceID,
				"use_fast_mode":      body.UseFastMode,
			},
			"openai_tts": fiber.Map{
				"voice": body.OpenAIVoice,
				"model": body.OpenAIModel,
			},
		})
	}

	// ---- Fall back to Python AI service ----
	aiPayload := map[string]interface{}{
		"message": body.Message,
		"workflow": map[string]interface{}{
			"nodes":       nodes,
			"connections": connections,
		},
		"conversation_history": body.ConversationHistory,
		"session_id":           body.SessionID,
		"openai_api_key":       userAPIKey,
		"tts_provider":         body.TTSProvider,
		"openai_voice":         body.OpenAIVoice,
		"openai_model":         body.OpenAIModel,
		"tts_mode":             body.TTSMode,
		"voice_name":           body.VoiceName,
		"instruction":          body.Instruction,
		"voice_description":    body.VoiceDescription,
		"reference_voice_id":   body.ReferenceVoiceID,
		"use_fast_mode":        body.UseFastMode,
	}

	reqBody, err := json.Marshal(aiPayload)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build request"})
	}

	aiURL := getQwenTTSServiceURL() + "/talk"
	log.Printf("[DEBUG] Calling AI /talk at: %s", aiURL)

	transport := &http.Transport{ResponseHeaderTimeout: 180 * time.Second}
	client := &http.Client{Transport: transport}

	req, err := http.NewRequest("POST", aiURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[ERROR] AI /talk call failed: %v", err)
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "AI service unavailable"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "AI /talk error: " + string(bodyBytes)})
	}

	c.Set("Content-Type", "application/json")
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusBadGateway).JSON(fiber.Map{"error": "failed to read AI response"})
	}
	return c.Send(bodyBytes)
}

// =============================================================================
// TTS Sentence — Single sentence → Qwen TTS (complete WAV, no streaming)
// =============================================================================

// TTSSentence proxies a single sentence TTS request to the AI backend.
// Called by the frontend pipeline: one call per sentence chunk.
func TTSSentence(c *fiber.Ctx) error {
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	aiURL := getQwenTTSServiceURL() + "/tts-sentence"

	transport := &http.Transport{
		ResponseHeaderTimeout: 180 * time.Second,
	}
	client := &http.Client{Transport: transport}

	req, err := http.NewRequest("POST", aiURL, bytes.NewReader(c.Body()))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "AI TTS service unavailable"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": string(bodyBytes)})
	}

	c.Set("Content-Type", "audio/wav")

	audioBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusBadGateway).JSON(fiber.Map{"error": "failed to read TTS audio"})
	}
	return c.Send(audioBytes)
}

// =============================================================================
// Text-to-Voice — Direct text → Qwen TTS (no workflow)
// =============================================================================

// TextToVoice proxies a simple text-to-voice request.
func TextToVoice(c *fiber.Ctx) error {
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	text := c.FormValue("text")
	if text == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "text is required"})
	}

	// Build multipart form to AI backend
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	_ = writer.WriteField("text", text)
	_ = writer.WriteField("tts_mode", c.FormValue("tts_mode", "custom"))
	_ = writer.WriteField("voice_name", c.FormValue("voice_name", "serena"))
	if v := c.FormValue("instruction"); v != "" {
		_ = writer.WriteField("instruction", v)
	}
	if v := c.FormValue("voice_description"); v != "" {
		_ = writer.WriteField("voice_description", v)
	}
	if v := c.FormValue("reference_voice_id"); v != "" {
		_ = writer.WriteField("reference_voice_id", v)
	}
	_ = writer.WriteField("use_fast_mode", c.FormValue("use_fast_mode", "true"))
	writer.Close()

	aiURL := getQwenTTSServiceURL() + "/talk/text-to-voice"

	// Transport-level timeout only — don't kill the body stream
	transport := &http.Transport{
		ResponseHeaderTimeout: 180 * time.Second,
	}
	client := &http.Client{Transport: transport}

	req, err := http.NewRequest("POST", aiURL, &buf)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "AI service unavailable"})
	}

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": string(bodyBytes)})
	}

	c.Set("Content-Type", "audio/wav")
	c.Set("Transfer-Encoding", "chunked")

	// TRUE streaming: flush each chunk immediately
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer resp.Body.Close()
		buf := make([]byte, 32768)
		for {
			n, readErr := resp.Body.Read(buf)
			if n > 0 {
				if _, writeErr := w.Write(buf[:n]); writeErr != nil {
					return
				}
				if flushErr := w.Flush(); flushErr != nil {
					return
				}
			}
			if readErr != nil {
				return
			}
		}
	})
	return nil
}

// =============================================================================
// Voice Reference Cache — CRUD proxy
// =============================================================================

// UploadVoiceReference proxies a reference audio upload to the AI backend.
func UploadVoiceReference(c *fiber.Ctx) error {
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "no file uploaded"})
	}

	src, err := file.Open()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open file"})
	}
	defer src.Close()

	// Build multipart to AI backend
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", file.Filename)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create form file"})
	}
	if _, err := io.Copy(part, src); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to copy file"})
	}

	refTranscript := c.FormValue("ref_transcript", "")
	if refTranscript != "" {
		_ = writer.WriteField("ref_transcript", refTranscript)
	}
	writer.Close()

	aiURL := getQwenTTSServiceURL() + "/voice-references/upload"
	client := &http.Client{Timeout: 60 * time.Second}

	req, err := http.NewRequest("POST", aiURL, &buf)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "AI service unavailable"})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	c.Set("Content-Type", "application/json")
	return c.Status(resp.StatusCode).Send(bodyBytes)
}

// ListVoiceReferences lists cached voice references from the AI backend.
func ListVoiceReferences(c *fiber.Ctx) error {
	aiURL := getQwenTTSServiceURL() + "/voice-references"
	return proxyGET(c, aiURL)
}

// GetVoiceReference gets a single voice reference.
func GetVoiceReference(c *fiber.Ctx) error {
	refID := c.Params("refId")
	aiURL := fmt.Sprintf("%s/voice-references/%s", getQwenTTSServiceURL(), refID)
	return proxyGET(c, aiURL)
}

// UpdateVoiceReference updates the transcript for a cached voice reference.
func UpdateVoiceReference(c *fiber.Ctx) error {
	refID := c.Params("refId")

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	_ = writer.WriteField("ref_transcript", c.FormValue("ref_transcript", ""))
	writer.Close()

	aiURL := fmt.Sprintf("%s/voice-references/%s", getQwenTTSServiceURL(), refID)
	client := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequest("PUT", aiURL, &buf)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "AI service unavailable"})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	c.Set("Content-Type", "application/json")
	return c.Status(resp.StatusCode).Send(bodyBytes)
}

// DeleteVoiceReference deletes a cached voice reference.
func DeleteVoiceReference(c *fiber.Ctx) error {
	refID := c.Params("refId")
	aiURL := fmt.Sprintf("%s/voice-references/%s", getQwenTTSServiceURL(), refID)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("DELETE", aiURL, nil)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "AI service unavailable"})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	c.Set("Content-Type", "application/json")
	return c.Status(resp.StatusCode).Send(bodyBytes)
}

// QwenTTSHealth proxies health check to the AI backend's Qwen TTS health.
func QwenTTSHealth(c *fiber.Ctx) error {
	aiURL := getQwenTTSServiceURL() + "/qwen-tts/health"
	return proxyGET(c, aiURL)
}

// proxyGET is a small helper to proxy a GET request to the AI backend.
func proxyGET(c *fiber.Ctx, url string) error {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("X-API-Key", os.Getenv("MANJU_API_KEY"))

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "AI service unavailable"})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	c.Set("Content-Type", "application/json")
	return c.Status(resp.StatusCode).Send(bodyBytes)
}
