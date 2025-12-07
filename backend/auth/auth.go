package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"log"

	"os"
	"strings"
	"time"

	"manju/backend/config/database"
	"manju/backend/repository"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/datatypes"
)

var googleOAuthConfig *oauth2.Config

func init() {
	// Prefer REDIRECT_URI (from .env) for consistency with the project file,
	// fall back to OAUTH_REDIRECT_URL, then to a sensible default.
	redirect := strings.TrimSpace(os.Getenv("REDIRECT_URI"))
	if redirect == "" {
		redirect = strings.TrimSpace(os.Getenv("OAUTH_REDIRECT_URL"))
	}
	if redirect == "" {
		redirect = "http://localhost:8080/auth/callback/google"
	}
	clientID := strings.TrimSpace(os.Getenv("CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("CLIENT_SECRET"))
	googleOAuthConfig = &oauth2.Config{
		RedirectURL:  redirect,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
	// Mask and log the client id and redirect for debugging (do not log secrets)
	cid := os.Getenv("CLIENT_ID")
	masked := cid
	if len(cid) > 8 {
		masked = cid[:4] + "..." + cid[len(cid)-4:]
	}
	log.Printf("OAuth CLIENT_ID=%s REDIRECT=%s", masked, redirect)
}

func generateState(c *fiber.Ctx) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	// use RawURLEncoding to avoid padding (=) and keep the cookie a bit shorter
	state := base64.RawURLEncoding.EncodeToString(b)
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
	// Diagnostic logging: log request header and cookie size to help debug 431 errors
	cookieHeader := c.Get("Cookie")
	totalHeaderLen := 0
	c.Request().Header.VisitAll(func(k, v []byte) {
		totalHeaderLen += len(k) + len(v)
	})
	log.Printf("Auth Login request headers total bytes=%d cookieHeaderBytes=%d", totalHeaderLen, len(cookieHeader))

	// Clear existing cookies sent by the browser to avoid oversized Cookie header
	// which can cause 431 errors when redirecting to external providers.
	// We parse the Cookie header and clear each cookie server-side.
	if cookieHeader != "" {
		parts := strings.Split(cookieHeader, ";")
		cleared := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			kv := strings.SplitN(p, "=", 2)
			name := strings.TrimSpace(kv[0])
			if name == "" {
				continue
			}
			// Clear cookie by name
			c.ClearCookie(name)
			cleared = append(cleared, name)
		}
		if len(cleared) > 0 {
			log.Printf("Cleared cookies before OAuth login: %v", cleared)
		}
	}

	state, err := generateState(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to generate oauth state")
	}
	url := googleOAuthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	// Log the generated auth URL with client_id masked for diagnosis
	// mask client_id value in the URL
	maskedUrl := url
	if cid := os.Getenv("CLIENT_ID"); cid != "" {
		maskedCid := cid
		if len(cid) > 8 {
			maskedCid = cid[:4] + "..." + cid[len(cid)-4:]
		}
		maskedUrl = strings.ReplaceAll(maskedUrl, cid, maskedCid)
	}
	log.Printf("Auth URL: %s", maskedUrl)
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

	// Persist user (create if not exists)
	email, _ := gu["email"].(string)
	name, _ := gu["name"].(string)
	infoBytes, _ := json.Marshal(gu)

	userRepo := repository.New(database.Database)
	user, err := userRepo.GetByEmail(email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("db error")
	}
	if user == nil {
		newUser := &repository.User{
			Email:  email,
			Name:   name,
			Info:   datatypes.JSON(infoBytes),
			Status: repository.StatusActive,
		}
		created, err := userRepo.Create(newUser)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("failed to create user")
		}
		user = created
	}

	// Create server-side session and persist refresh token if provided
	sessionRepo := repository.NewSession(database.Database)
	var expires *time.Time
	if !token.Expiry.IsZero() {
		t := token.Expiry
		expires = &t
	}
	session := &repository.Session{
		UserID:       user.ID,
		RefreshToken: token.RefreshToken,
		ExpiresAt:    expires,
	}
	createdSession, err := sessionRepo.Create(session)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to create session")
	}

	// Set httpOnly session cookie (do not expose tokens in URL)
	cookie := &fiber.Cookie{
		Name:     "manju_session",
		Value:    createdSession.ID.String(),
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   false, // set true in production with HTTPS
		Path:     "/",
	}
	c.Cookie(cookie)

	// clear oauth state
	c.ClearCookie("oauthstate")

	frontend := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if frontend == "" {
		frontend = "http://localhost:5173"
	}
	return c.Redirect(frontend, fiber.StatusTemporaryRedirect)
}

// Me returns the authenticated user's basic info based on session cookie
func Me(c *fiber.Ctx) error {
	sid := c.Cookies("manju_session")
	if sid == "" {
		return c.Status(fiber.StatusUnauthorized).SendString("unauthenticated")
	}
	sessionRepo := repository.NewSession(database.Database)
	sess, err := sessionRepo.GetByID(sid)
	if err != nil || sess == nil {
		return c.Status(fiber.StatusUnauthorized).SendString("unauthenticated")
	}
	userRepo := repository.New(database.Database)
	user, err := userRepo.GetByID(sess.UserID.String())
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).SendString("unauthenticated")
	}
	return c.JSON(fiber.Map{"id": user.ID, "email": user.Email, "name": user.Name})
}

// RequireAuth is a middleware that ensures the request has a valid session.
// It sets `userID` in `c.Locals` for downstream handlers.
func RequireAuth(c *fiber.Ctx) error {
	sid := c.Cookies("manju_session")
	if sid == "" {
		return c.Status(fiber.StatusUnauthorized).SendString("unauthenticated")
	}
	sessionRepo := repository.NewSession(database.Database)
	sess, err := sessionRepo.GetByID(sid)
	if err != nil || sess == nil {
		return c.Status(fiber.StatusUnauthorized).SendString("unauthenticated")
	}
	// Set userID for handlers
	c.Locals("userID", sess.UserID.String())
	return c.Next()
}

// Logout deletes the server session and clears the session cookie.
func Logout(c *fiber.Ctx) error {
	sid := c.Cookies("manju_session")
	if sid != "" {
		sessionRepo := repository.NewSession(database.Database)
		_ = sessionRepo.DeleteByID(sid)
	}
	// Clear the cookie in browser
	c.ClearCookie("manju_session")
	// Optional: clear oauthstate too
	c.ClearCookie("oauthstate")

	frontend := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if frontend == "" {
		frontend = "http://localhost:5173"
	}
	// Redirect back to frontend home
	return c.Redirect(frontend, fiber.StatusSeeOther)
}
