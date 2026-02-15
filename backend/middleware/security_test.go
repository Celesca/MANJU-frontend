package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// helper that creates a Fiber app with APIKeyGuard middleware + a simple handler
func setupApp() *fiber.App {
	app := fiber.New()
	app.Use(APIKeyGuard())
	app.Get("/api/test", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})
	app.Get("/auth/callback", func(c *fiber.Ctx) error {
		return c.SendString("auth OK")
	})
	return app
}

// ---------- APIKeyGuard Tests ----------

func TestAPIKeyGuard_NoKeyConfigured(t *testing.T) {
	os.Unsetenv("MANJU_API_KEY")
	app := setupApp()

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200 when no API key configured, got %d", resp.StatusCode)
	}
}

func TestAPIKeyGuard_ValidKey(t *testing.T) {
	os.Setenv("MANJU_API_KEY", "test-secret-key")
	defer os.Unsetenv("MANJU_API_KEY")

	app := setupApp()

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("X-API-Key", "test-secret-key")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200 with valid key, got %d", resp.StatusCode)
	}
}

func TestAPIKeyGuard_InvalidKey(t *testing.T) {
	os.Setenv("MANJU_API_KEY", "test-secret-key")
	defer os.Unsetenv("MANJU_API_KEY")

	app := setupApp()

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("X-API-Key", "wrong-key")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected 401 with invalid key, got %d", resp.StatusCode)
	}
}

func TestAPIKeyGuard_MissingKey(t *testing.T) {
	os.Setenv("MANJU_API_KEY", "test-secret-key")
	defer os.Unsetenv("MANJU_API_KEY")

	app := setupApp()

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	// No X-API-Key header
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected 401 with missing key, got %d", resp.StatusCode)
	}
}

func TestAPIKeyGuard_SkipsOPTIONS(t *testing.T) {
	os.Setenv("MANJU_API_KEY", "test-secret-key")
	defer os.Unsetenv("MANJU_API_KEY")

	app := setupApp()

	req := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	// No X-API-Key header, but OPTIONS should be skipped
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	// Fiber returns 405 for OPTIONS if no handler, but middleware should still pass
	if resp.StatusCode == http.StatusUnauthorized {
		t.Error("OPTIONS requests should not be blocked by APIKeyGuard")
	}
}

func TestAPIKeyGuard_SkipsAuthRoutes(t *testing.T) {
	os.Setenv("MANJU_API_KEY", "test-secret-key")
	defer os.Unsetenv("MANJU_API_KEY")

	app := setupApp()

	req := httptest.NewRequest(http.MethodGet, "/auth/callback", nil)
	// No X-API-Key header, but /auth/ routes should be skipped
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Auth routes should bypass API key check, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "auth OK" {
		t.Errorf("Expected 'auth OK', got %q", string(body))
	}
}
