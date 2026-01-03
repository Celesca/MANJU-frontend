package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"manju/backend/config/database"
	"manju/backend/repository"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/datatypes"
)

var googleOAuthConfig *oauth2.Config
var jwtSecret []byte

func init() {
	// JWT Secret from environment or generate random
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		secret = strings.TrimSpace(os.Getenv("ENCRYPTION_KEY"))
	}
	if secret == "" {
		secret = "manju-default-secret-change-in-production"
	}
	jwtSecret = []byte(secret)

	// OAuth config
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
	// Log masked client id
	cid := clientID
	if len(cid) > 8 {
		cid = cid[:4] + "..." + cid[len(cid)-4:]
	}
	log.Printf("OAuth CLIENT_ID=%s REDIRECT=%s", cid, redirect)
}

// JWTClaims defines the claims in our JWT
type JWTClaims struct {
	UserID  string `json:"user_id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
	jwt.RegisteredClaims
}

// GenerateJWT creates a signed JWT token for a user
func GenerateJWT(userID, email, name, picture string) (string, error) {
	claims := JWTClaims{
		UserID:  userID,
		Email:   email,
		Name:    name,
		Picture: picture,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "manju",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ValidateJWT parses and validates a JWT token
func ValidateJWT(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, jwt.ErrSignatureInvalid
}

// ExtractBearerToken extracts the token from Authorization header
func ExtractBearerToken(c *fiber.Ctx) string {
	auth := c.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}

func generateState(c *fiber.Ctx) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	state := base64.RawURLEncoding.EncodeToString(b)
	// Use a simple cookie for state verification (short-lived, same-site)
	c.Cookie(&fiber.Cookie{
		Name:     "oauthstate",
		Value:    state,
		Expires:  time.Now().Add(10 * time.Minute),
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Lax",
		Path:     "/",
	})
	return state, nil
}

// Login starts the OAuth2 flow
func Login(c *fiber.Ctx) error {
	state, err := generateState(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to generate oauth state")
	}
	authURL := googleOAuthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	return c.Redirect(authURL, fiber.StatusTemporaryRedirect)
}

// Callback handles the OAuth2 callback, creates user, generates JWT, and redirects to frontend
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

	// Exchange code for token
	token, err := googleOAuthConfig.Exchange(context.Background(), code)
	if err != nil {
		log.Printf("Token exchange failed: %v", err)
		return c.Status(fiber.StatusInternalServerError).SendString("failed to exchange token")
	}

	// Fetch user info from Google
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

	// Extract user info
	email, _ := gu["email"].(string)
	name, _ := gu["name"].(string)
	picture, _ := gu["picture"].(string)
	infoBytes, _ := json.Marshal(gu)

	// Persist user (create if not exists)
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

	// Generate JWT
	jwtToken, err := GenerateJWT(user.ID.String(), user.Email, user.Name, picture)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("failed to generate token")
	}

	// Clear oauth state cookie
	c.Cookie(&fiber.Cookie{
		Name:     "oauthstate",
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-1 * time.Hour),
		HTTPOnly: true,
	})

	// Redirect to frontend with token in URL fragment (fragment is not sent to server)
	frontend := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/")
	if frontend == "" {
		frontend = "http://localhost:5173"
	}
	// Use URL fragment so token is not logged in server access logs
	redirectURL := frontend + "#token=" + url.QueryEscape(jwtToken)
	return c.Redirect(redirectURL, fiber.StatusTemporaryRedirect)
}

// Me returns the authenticated user's info based on JWT token
func Me(c *fiber.Ctx) error {
	tokenString := ExtractBearerToken(c)
	if tokenString == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "no token provided"})
	}

	claims, err := ValidateJWT(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
	}

	return c.JSON(fiber.Map{
		"id":      claims.UserID,
		"email":   claims.Email,
		"name":    claims.Name,
		"picture": claims.Picture,
	})
}

// RequireAuth is a middleware that validates JWT and sets userID in context
func RequireAuth(c *fiber.Ctx) error {
	tokenString := ExtractBearerToken(c)
	if tokenString == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "no token provided"})
	}

	claims, err := ValidateJWT(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
	}

	c.Locals("userID", claims.UserID)
	return c.Next()
}

// Logout just returns success - token invalidation is client-side
func Logout(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Logged out successfully",
	})
}
