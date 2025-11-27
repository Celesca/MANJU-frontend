package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var googleOAuthConfig *oauth2.Config

func init() {
	redirect := os.Getenv("OAUTH_REDIRECT_URL")
	if redirect == "" {
		redirect = "http://localhost:8080/api/auth/callback/google"
	}
	googleOAuthConfig = &oauth2.Config{
		RedirectURL:  redirect,
		ClientID:     os.Getenv("CLIENT_ID"),
		ClientSecret: os.Getenv("CLIENT_SECRET"),
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

func generateState(c *fiber.Ctx) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	state := base64.URLEncoding.EncodeToString(b)
	c.Cookie(&fiber.Cookie{ // set a short-lived cookie to verify state
		Name:    "oauthstate",
		Value:   state,
		Expires: time.Now().Add(1 * time.Hour),
		Path:    "/",
	})
	return state, nil
}

// Login starts the OAuth2 flow and redirects the user to Google's consent screen.
func Login(c *fiber.Ctx) error {
	state, err := generateState(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to generate oauth state")
	}
	url := googleOAuthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	return c.Redirect(url, fiber.StatusTemporaryRedirect)
}

// Callback handles the OAuth2 callback from Google, exchanges the code for a token
// and fetches basic user info. It returns the user info and token as JSON.
func Callback(c *fiber.Ctx) error {
	state := c.Query("state")
	cookieState := c.Cookies("oauthstate")
	if state == "" || cookieState == "" || state != cookieState {
		return c.Status(fiber.StatusBadRequest).SendString("invalid oauth state")
	}
	code := c.Query("code")
	if code == "" {
		return c.Status(fiber.StatusBadRequest).SendString("code not found")
	}

	token, err := googleOAuthConfig.Exchange(context.Background(), code)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to exchange token")
	}

	client := googleOAuthConfig.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to get userinfo")
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to read userinfo")
	}

	var gu map[string]interface{}
	if err := json.Unmarshal(body, &gu); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to parse userinfo")
	}

	// At this point you would typically create or lookup the user in your DB
	// and create a session/jwt. For now, return the Google user info + token.
	return c.JSON(fiber.Map{
		"user":  gu,
		"token": token,
	})
}
