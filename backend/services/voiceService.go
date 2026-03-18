package services

import (
	"bytes"
	"context"
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

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
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
		url = "http://127.0.0.1:8000" // Use 127.0.0.1 instead of localhost to avoid IPv6 issues
	}
	return url
}

// getAzureBlobClient creates an Azure Blob Storage client
func getAzureBlobClient() (*azblob.Client, error) {
	connStr := os.Getenv("AZURE_STORAGE_CONNECTION_STRING")
	if connStr == "" {
		return nil, fmt.Errorf("AZURE_STORAGE_CONNECTION_STRING not set")
	}

	client, err := azblob.NewClientFromConnectionString(connStr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create Azure client: %w", err)
	}

	return client, nil
}

// getAzureContainerName returns the Azure container name
func getAzureContainerName() string {
	container := os.Getenv("AZURE_STORAGE_CONTAINER")
	if container == "" {
		container = "voices"
	}
	return container
}

// isAzureEnabled checks if Azure storage is configured
func isAzureEnabled() bool {
	return os.Getenv("AZURE_STORAGE_CONNECTION_STRING") != ""
}

// sanitizeFilename removes invalid characters from voice name for use in blob path
func sanitizeFilename(name string) string {
	// Replace spaces with underscores, remove special characters
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			return r
		}
		return '_'
	}, name)
	return name
}

// UploadVoiceFile handles voice audio file uploads (Azure or local)
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

	// Get voice name from form (optional, falls back to timestamp)
	voiceName := c.FormValue("voice_name", "")
	if voiceName == "" {
		voiceName = fmt.Sprintf("voice_%d", time.Now().Unix())
	}
	voiceName = sanitizeFilename(voiceName)

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

	// Open the file
	src, err := file.Open()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to open file"})
	}
	defer src.Close()

	// Read file content
	fileContent, err := io.ReadAll(src)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read file"})
	}

	// Blob path: {user_id}/{voice_name}.{ext}
	blobPath := fmt.Sprintf("%s/%s%s", userIDStr.(string), voiceName, ext)

	// Use Azure Blob Storage if configured
	if isAzureEnabled() {
		client, err := getAzureBlobClient()
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}

		containerName := getAzureContainerName()
		ctx := context.Background()

		// Upload to Azure
		_, err = client.UploadBuffer(ctx, containerName, blobPath, fileContent, nil)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to upload to Azure: " + err.Error()})
		}

		// Get storage account name from connection string
		connStr := os.Getenv("AZURE_STORAGE_CONNECTION_STRING")
		accountName := ""
		for _, part := range strings.Split(connStr, ";") {
			if strings.HasPrefix(part, "AccountName=") {
				accountName = strings.TrimPrefix(part, "AccountName=")
				break
			}
		}

		// Build public URL
		fileURL := fmt.Sprintf("https://%s.blob.core.windows.net/%s/%s", accountName, containerName, blobPath)

		return c.Status(http.StatusCreated).JSON(fiber.Map{
			"url":      fileURL,
			"filename": voiceName + ext,
			"size":     file.Size,
			"storage":  "azure",
		})
	}

	// Fallback to local storage
	basePath := os.Getenv("VOICES_STORAGE_PATH")
	if basePath == "" {
		basePath = "./uploads/voices"
	}
	userPath := filepath.Join(basePath, userIDStr.(string))

	if err := os.MkdirAll(userPath, 0755); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create directory"})
	}

	filePath := filepath.Join(userPath, voiceName+ext)
	if err := os.WriteFile(filePath, fileContent, 0644); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save file"})
	}

	// Return local API URL
	fileURL := fmt.Sprintf("/api/voices/files/%s/%s%s", userIDStr.(string), voiceName, ext)

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"url":      fileURL,
		"filename": voiceName + ext,
		"size":     file.Size,
		"storage":  "local",
	})
}

// ServeVoiceFile serves uploaded voice files (local storage only)
func ServeVoiceFile(c *fiber.Ctx) error {
	userID := c.Params("user_id")
	filename := c.Params("filename")

	if userID == "" || filename == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "missing parameters"})
	}

	// Sanitize filename to prevent path traversal
	filename = filepath.Base(filename)

	basePath := os.Getenv("VOICES_STORAGE_PATH")
	if basePath == "" {
		basePath = "./uploads/voices"
	}
	filePath := filepath.Join(basePath, userID, filename)

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

	// Read reference audio
	var audioBytes []byte

	if strings.HasPrefix(voice.VoiceURL, "https://") || strings.HasPrefix(voice.VoiceURL, "http://") {
		// External URL (Azure Blob or other) - download it
		audioResp, err := http.Get(voice.VoiceURL)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch reference audio: " + err.Error()})
		}
		defer audioResp.Body.Close()

		if audioResp.StatusCode != http.StatusOK {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch reference audio: status " + audioResp.Status})
		}

		audioBytes, err = io.ReadAll(audioResp.Body)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read reference audio"})
		}
	} else if strings.HasPrefix(voice.VoiceURL, "/api/voices/files/") {
		// Local file - extract path
		parts := strings.Split(strings.TrimPrefix(voice.VoiceURL, "/api/voices/files/"), "/")
		if len(parts) >= 2 {
			basePath := os.Getenv("VOICES_STORAGE_PATH")
			if basePath == "" {
				basePath = "./uploads/voices"
			}
			filePath := filepath.Join(basePath, parts[0], parts[1])
			audioBytes, err = os.ReadFile(filePath)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read reference audio file"})
			}
		} else {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid voice URL format"})
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
