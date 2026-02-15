package services

import (
	"os"
	"testing"
)

// ---------- getDocumentsStoragePath ----------

func TestGetDocumentsStoragePath_Default(t *testing.T) {
	os.Unsetenv("DOCUMENTS_STORAGE_PATH")
	path := getDocumentsStoragePath()
	if path != "./uploads/documents" {
		t.Errorf("Expected default path, got %q", path)
	}
}

func TestGetDocumentsStoragePath_Custom(t *testing.T) {
	t.Setenv("DOCUMENTS_STORAGE_PATH", "/data/docs")
	path := getDocumentsStoragePath()
	if path != "/data/docs" {
		t.Errorf("Expected '/data/docs', got %q", path)
	}
}

// ---------- ensureUserDocumentDir ----------

func TestEnsureUserDocumentDir(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("DOCUMENTS_STORAGE_PATH", tmpDir)

	dirPath, err := ensureUserDocumentDir("user123", "proj456")
	if err != nil {
		t.Fatalf("ensureUserDocumentDir failed: %v", err)
	}

	// Check directory was created
	info, err := os.Stat(dirPath)
	if err != nil {
		t.Fatalf("Expected directory to exist: %v", err)
	}
	if !info.IsDir() {
		t.Error("Expected a directory")
	}
}

// ---------- CopyDocumentContent ----------

func TestCopyDocumentContent_Success(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := tmpDir + "/test.txt"
	expected := "Hello, this is test content!"
	os.WriteFile(filePath, []byte(expected), 0644)

	content, err := CopyDocumentContent(filePath)
	if err != nil {
		t.Fatalf("CopyDocumentContent failed: %v", err)
	}
	if content != expected {
		t.Errorf("Expected %q, got %q", expected, content)
	}
}

func TestCopyDocumentContent_FileNotFound(t *testing.T) {
	_, err := CopyDocumentContent("/nonexistent/file.txt")
	if err == nil {
		t.Error("Expected error for nonexistent file, got nil")
	}
}

// ---------- ProxyDocumentToAI ----------

func TestProxyDocumentToAI(t *testing.T) {
	t.Setenv("DOCUMENTS_STORAGE_PATH", "./uploads/documents")
	path, err := ProxyDocumentToAI("user1", "proj1")
	if err != nil {
		t.Fatalf("ProxyDocumentToAI failed: %v", err)
	}
	if path == "" {
		t.Error("Expected non-empty path")
	}
}

// ---------- getF5TTSServiceURL ----------

func TestGetF5TTSServiceURL_Default(t *testing.T) {
	os.Unsetenv("F5_TTS_SERVICE_URL")
	url := getF5TTSServiceURL()
	if url != "http://127.0.0.1:8000" {
		t.Errorf("Expected default URL, got %q", url)
	}
}

func TestGetF5TTSServiceURL_Custom(t *testing.T) {
	t.Setenv("F5_TTS_SERVICE_URL", "http://tts:5000")
	url := getF5TTSServiceURL()
	if url != "http://tts:5000" {
		t.Errorf("Expected custom URL, got %q", url)
	}
}

// ---------- isAzureEnabled ----------

func TestIsAzureEnabled_NotSet(t *testing.T) {
	os.Unsetenv("AZURE_STORAGE_CONNECTION_STRING")
	if isAzureEnabled() {
		t.Error("Expected false when AZURE_STORAGE_CONNECTION_STRING not set")
	}
}

func TestIsAzureEnabled_Set(t *testing.T) {
	t.Setenv("AZURE_STORAGE_CONNECTION_STRING", "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc")
	if !isAzureEnabled() {
		t.Error("Expected true when AZURE_STORAGE_CONNECTION_STRING is set")
	}
}

// ---------- getAzureContainerName ----------

func TestGetAzureContainerName_Default(t *testing.T) {
	os.Unsetenv("AZURE_STORAGE_CONTAINER")
	name := getAzureContainerName()
	if name != "voices" {
		t.Errorf("Expected 'voices', got %q", name)
	}
}

func TestGetAzureContainerName_Custom(t *testing.T) {
	t.Setenv("AZURE_STORAGE_CONTAINER", "my-container")
	name := getAzureContainerName()
	if name != "my-container" {
		t.Errorf("Expected 'my-container', got %q", name)
	}
}
