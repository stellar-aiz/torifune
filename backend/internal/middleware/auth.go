package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// contextKey is a custom type for context keys to avoid collisions.
type contextKey string

const (
	// UserIDKey is the context key for the authenticated user ID.
	UserIDKey contextKey = "userID"
	// ClaimsKey is the context key for the JWT claims.
	ClaimsKey contextKey = "claims"
)

// Claims represents the JWT claims structure.
type Claims struct {
	jwt.RegisteredClaims
	UserID string `json:"user_id"`
	Email  string `json:"email"`
}

// AuthConfig holds the configuration for the auth middleware.
type AuthConfig struct {
	JWTSecret   string
	SkipPaths   []string
	SkipPrefixes []string
}

// Auth creates a JWT authentication middleware.
// It validates the Bearer token from the Authorization header and sets
// user information in the request context.
func Auth(cfg AuthConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if the path should bypass authentication
			if shouldSkipAuth(r.URL.Path, cfg.SkipPaths, cfg.SkipPrefixes) {
				next.ServeHTTP(w, r)
				return
			}

			// Extract the Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			// Check for Bearer token format
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			// Parse and validate the JWT token
			claims := &Claims{}
			token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
				// Validate the signing method
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(cfg.JWTSecret), nil
			})

			if err != nil || !token.Valid {
				http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
				return
			}

			// Set user information in context
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, ClaimsKey, claims)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// shouldSkipAuth checks if the given path should bypass authentication.
func shouldSkipAuth(path string, skipPaths, skipPrefixes []string) bool {
	// Check exact path matches
	for _, skipPath := range skipPaths {
		if path == skipPath {
			return true
		}
	}

	// Check prefix matches
	for _, prefix := range skipPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}

	return false
}

// GetUserID retrieves the user ID from the request context.
// Returns an empty string if not found.
func GetUserID(ctx context.Context) string {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok {
		return ""
	}
	return userID
}

// GetClaims retrieves the JWT claims from the request context.
// Returns nil if not found.
func GetClaims(ctx context.Context) *Claims {
	claims, ok := ctx.Value(ClaimsKey).(*Claims)
	if !ok {
		return nil
	}
	return claims
}
