package services

import (
	"testing"
)

// ---------- contains helper ----------

func TestContains_Found(t *testing.T) {
	slice := []string{"text-input", "ai-model", "text-output"}
	if !contains(slice, "ai-model") {
		t.Error("Expected contains to return true for 'ai-model'")
	}
}

func TestContains_NotFound(t *testing.T) {
	slice := []string{"text-input", "ai-model", "text-output"}
	if contains(slice, "voice-input") {
		t.Error("Expected contains to return false for 'voice-input'")
	}
}

func TestContains_EmptySlice(t *testing.T) {
	if contains([]string{}, "anything") {
		t.Error("Expected contains to return false for empty slice")
	}
}

// ---------- getAIServiceURL ----------

func TestGetAIServiceURL_Default(t *testing.T) {
	t.Setenv("AI_SERVICE_URL", "")
	url := getAIServiceURL()
	if url != "http://localhost:8000" {
		t.Errorf("Expected default URL 'http://localhost:8000', got %q", url)
	}
}

func TestGetAIServiceURL_Custom(t *testing.T) {
	t.Setenv("AI_SERVICE_URL", "http://ai-service:9000")
	url := getAIServiceURL()
	if url != "http://ai-service:9000" {
		t.Errorf("Expected custom URL 'http://ai-service:9000', got %q", url)
	}
}
