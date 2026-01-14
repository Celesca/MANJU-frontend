package services

import (
	"bytes"
	"fmt"
	"io"
	"manju/backend/models/request"
	"manju/backend/repository"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// CloneVoiceRequest represents the request body for voice cloning
type CloneVoiceRequest struct {
	GenText       string  `json:"gen_text"`
	NfeStep       int     `json:"nfe_step"`
	Speed         float64 `json:"speed"`
	CfgStrength   float64 `json:"cfg_strength"`
	RemoveSilence bool    `json:"remove_silence"`
}

// getF5TTSServiceURL returns the F5-TTS service URL from environment or default
func getF5TTSServiceURL() string {
	url := os.Getenv("F5_TTS_SERVICE_URL")
	if url == "" {
		url = "http://localhost:8000"
	}
	return url
}

// getVoicesStoragePath returns the base path for voice file storage
func getVoicesStoragePath() string {
	path := os.Getenv("VOICES_STORAGE_PATH")
	if path == "" {
		path = "./uploads/voices"
	}
	return path
}

// ensureVoiceDir creates the user-specific voice directory
func ensureVoiceDir(userID string) (string, error) {
	basePath := getVoicesStoragePath()
	userPath := filepath.Join(basePath, userID)

	if err := os.MkdirAll(userPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create voice directory: %w", err)
	}

	return userPath, nil
}

// UploadVoiceFile handles voice audio file uploads
func UploadVoiceFile(c *fiber.Ctx) error {
	// Get user ID from context
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get the uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "no file uploaded"})
	}

	// Validate file type
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{".wav": true, ".mp3": true, ".m4a": true, ".ogg": true, ".flac": true}
	if !allowedExts[ext] {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid file type. Allowed: wav, mp3, m4a, ogg, flac"})
	}

	// Validate file size (max 50MB)
	if file.Size > 50*1024*1024 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "file too large. Max size: 50MB"})
	}

	// Create user voice directory
	voiceDir, err := ensureVoiceDir(userIDStr.(string))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Generate unique filename
	fileID := uuid.New().String()
	safeFilename := fmt.Sprintf("%s_%s%s", fileID, time.Now().Format("20060102150405"), ext)
	filePath := filepath.Join(voiceDir, safeFilename)

	// Save the file
	if err := c.SaveFile(file, filePath); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save file"})
	}

	// Build the URL to access the file
	// Format: /api/voices/files/{user_id}/{filename}
	fileURL := fmt.Sprintf("/api/voices/files/%s/%s", userIDStr.(string), safeFilename)

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"url":      fileURL,
		"filename": safeFilename,
		"size":     file.Size,
	})
}

// ServeVoiceFile serves uploaded voice files
func ServeVoiceFile(c *fiber.Ctx) error {
	userID := c.Params("user_id")
	filename := c.Params("filename")

	if userID == "" || filename == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "missing parameters"})
	}

	// Sanitize filename to prevent path traversal
	filename = filepath.Base(filename)

	filePath := filepath.Join(getVoicesStoragePath(), userID, filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "file not found"})
	}

	return c.SendFile(filePath)
}

func CreateVoice(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	var body request.CreateVoicePayload
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	if body.VoiceName == "" || body.VoiceURL == "" || body.UserID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "voice_name, voice_url and user_id are required"})
	}

	uid, err := uuid.Parse(body.UserID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_id"})
	}

	v := repository.Voice{
		VoiceName: body.VoiceName,
		VoiceURL:  body.VoiceURL,
		RefText:   body.RefText,
		Gender:    body.Gender,
		AgeRange:  body.AgeRange,
		Language:  body.Language,
		UserID:    uid,
	}

	created, err := repo.Create(&v)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(http.StatusCreated).JSON(created)
}

func ListVoices(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	voices, err := repo.List()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(voices)
}

func ListVoicesByUser(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	userID := c.Params("user_id")
	voices, err := repo.ListByUser(userID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(voices)
}

func GetVoice(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	id := c.Params("id")
	v, err := repo.GetByID(id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if v == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
	}
	return c.JSON(v)
}

func DeleteVoice(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	id := c.Params("id")
	ok, err := repo.Delete(id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if !ok {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
	}
	return c.SendStatus(http.StatusNoContent)
}

// CloneVoice handles voice cloning by proxying to F5-TTS-THAI-API
func CloneVoice(c *fiber.Ctx, repo *repository.VoiceRepository) error {
	// Get user ID from context for authorization
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Get voice ID from params
	voiceID := c.Params("id")
	if voiceID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "voice id required"})
	}

	// Get voice from database
	voice, err := repo.GetByID(voiceID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if voice == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "voice not found"})
	}

	// Verify ownership
	if voice.UserID.String() != userIDStr.(string) {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}

	// Parse request body
	var body CloneVoiceRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	if body.GenText == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "gen_text is required"})
	}

	// Set defaults
	if body.NfeStep == 0 {
		body.NfeStep = 16
	}
	if body.Speed == 0 {
		body.Speed = 1.0
	}
	if body.CfgStrength == 0 {
		body.CfgStrength = 2.0
	}

	// Read reference audio from local file storage
	// Voice URL format: /api/voices/files/{user_id}/{filename}
	var audioBytes []byte

	if strings.HasPrefix(voice.VoiceURL, "/api/voices/files/") {
		// Local file - extract path
		parts := strings.Split(strings.TrimPrefix(voice.VoiceURL, "/api/voices/files/"), "/")
		if len(parts) >= 2 {
			filePath := filepath.Join(getVoicesStoragePath(), parts[0], parts[1])
			audioBytes, err = os.ReadFile(filePath)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read reference audio file"})
			}
		} else {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid voice URL format"})
		}
	} else if strings.HasPrefix(voice.VoiceURL, "http") {
		// External URL - download it
		audioResp, err := http.Get(voice.VoiceURL)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch reference audio"})
		}
		defer audioResp.Body.Close()

		audioBytes, err = io.ReadAll(audioResp.Body)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read reference audio"})
		}
	} else {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid voice URL - must be uploaded file or HTTP URL"})
	}

	// Build multipart request to F5-TTS-THAI-API
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)

	// Add reference audio file
	audioPart, err := writer.CreateFormFile("ref_audio", "reference.wav")
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create form file"})
	}
	if _, err := audioPart.Write(audioBytes); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to write audio data"})
	}

	// Add form fields
	_ = writer.WriteField("ref_text", voice.RefText)
	_ = writer.WriteField("gen_text", body.GenText)
	_ = writer.WriteField("nfe_step", fmt.Sprintf("%d", body.NfeStep))
	_ = writer.WriteField("speed", fmt.Sprintf("%.2f", body.Speed))
	_ = writer.WriteField("cfg_strength", fmt.Sprintf("%.2f", body.CfgStrength))
	_ = writer.WriteField("remove_silence", fmt.Sprintf("%t", body.RemoveSilence))
	_ = writer.WriteField("return_file", "true")

	if err := writer.Close(); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to close writer"})
	}

	// Call F5-TTS-THAI-API
	ttsURL := getF5TTSServiceURL() + "/tts"
	client := &http.Client{Timeout: 120 * time.Second}

	req, err := http.NewRequest("POST", ttsURL, &requestBody)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create TTS request"})
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "TTS service unavailable: " + err.Error()})
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "TTS generation failed: " + string(bodyBytes)})
	}

	// Stream the audio response back to client
	c.Set("Content-Type", "audio/wav")
	c.Set("Content-Disposition", "attachment; filename=\"generated.wav\"")

	return c.SendStream(resp.Body)
}
