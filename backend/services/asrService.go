package services

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

// TranscribeASR proxies an audio file upload to the AI service for Typhoon ASR transcription
func TranscribeASR(c *fiber.Ctx) error {
	// Get uploaded audio file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "audio file required"})
	}

	// Open the uploaded file
	src, err := fileHeader.Open()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read uploaded file"})
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read file data"})
	}

	// Build multipart request for AI service
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", fileHeader.Filename)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to build request"})
	}
	if _, err := part.Write(fileBytes); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to write file data"})
	}
	writer.Close()

	// Forward to AI service
	aiServiceURL := getAIServiceURL() + "/asr/transcribe"
	client := &http.Client{Timeout: 180 * time.Second}

	req, err := http.NewRequest("POST", aiServiceURL, &buf)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create request"})
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if apiKey := os.Getenv("MANJU_API_KEY"); apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(http.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("AI service unreachable at %s", aiServiceURL),
		})
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read AI response"})
	}

	c.Set("Content-Type", "application/json")
	return c.Status(resp.StatusCode).Send(responseBody)
}
