// Package handler provides HTTP handlers for the API.
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/stellar/torifune/backend/internal/model"
	"github.com/stellar/torifune/backend/internal/repository"
	"github.com/stellar/torifune/backend/internal/service/auth"
)

// AuthHandler handles authentication-related HTTP requests.
type AuthHandler struct {
	providers    map[auth.ProviderType]auth.OAuthProvider
	jwtService   *auth.JWTService
	userRepo     repository.UserRepository
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(
	providers map[auth.ProviderType]auth.OAuthProvider,
	jwtService *auth.JWTService,
	userRepo repository.UserRepository,
) *AuthHandler {
	return &AuthHandler{
		providers:  providers,
		jwtService: jwtService,
		userRepo:   userRepo,
	}
}

// LoginRequest represents the request body for the login endpoint.
type LoginRequest struct {
	// CodeChallenge is the PKCE code challenge (S256 hash of code_verifier).
	CodeChallenge string `json:"code_challenge"`
	// State is an optional state parameter for CSRF protection.
	// If not provided, the server will generate one.
	State string `json:"state,omitempty"`
}

// LoginResponse represents the response for the login endpoint.
type LoginResponse struct {
	// AuthURL is the OAuth provider's authorization URL.
	AuthURL string `json:"auth_url"`
	// State is the state parameter to verify in the callback.
	State string `json:"state"`
}

// CallbackRequest represents the request body for the callback endpoint.
type CallbackRequest struct {
	// Code is the authorization code from the OAuth provider.
	Code string `json:"code"`
	// State is the state parameter for CSRF protection.
	State string `json:"state"`
	// CodeVerifier is the PKCE code verifier (original random string).
	CodeVerifier string `json:"code_verifier"`
}

// CallbackResponse represents the response for the callback endpoint.
type CallbackResponse struct {
	// AccessToken is the JWT access token.
	AccessToken string `json:"access_token"`
	// RefreshToken is the JWT refresh token.
	RefreshToken string `json:"refresh_token"`
	// ExpiresIn is the access token expiration time in seconds.
	ExpiresIn int `json:"expires_in"`
	// User is the authenticated user's information.
	User *model.User `json:"user"`
}

// RefreshRequest represents the request body for the refresh endpoint.
type RefreshRequest struct {
	// RefreshToken is the JWT refresh token.
	RefreshToken string `json:"refresh_token"`
}

// RefreshResponse represents the response for the refresh endpoint.
type RefreshResponse struct {
	// AccessToken is the new JWT access token.
	AccessToken string `json:"access_token"`
	// RefreshToken is the new JWT refresh token.
	RefreshToken string `json:"refresh_token"`
	// ExpiresIn is the access token expiration time in seconds.
	ExpiresIn int `json:"expires_in"`
}

// Login handles POST /api/v1/auth/login/{provider}.
// It initiates the OAuth flow by returning the authorization URL.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	providerName := chi.URLParam(r, "provider")
	provider, ok := h.providers[auth.ProviderType(providerName)]
	if !ok {
		h.respondError(w, http.StatusBadRequest, "unsupported_provider", "OAuth provider not supported")
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	// Generate state if not provided.
	state := req.State
	if state == "" {
		state = uuid.New().String()
	}

	// Get the authorization URL with PKCE support.
	authURL := provider.GetAuthURL(state, req.CodeChallenge)

	h.respondJSON(w, http.StatusOK, LoginResponse{
		AuthURL: authURL,
		State:   state,
	})
}

// Callback handles GET /api/v1/auth/callback/{provider}.
// It exchanges the authorization code for tokens and creates/updates the user.
func (h *AuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	providerName := chi.URLParam(r, "provider")
	providerType := auth.ProviderType(providerName)
	provider, ok := h.providers[providerType]
	if !ok {
		h.respondError(w, http.StatusBadRequest, "unsupported_provider", "OAuth provider not supported")
		return
	}

	var req CallbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Code == "" {
		h.respondError(w, http.StatusBadRequest, "missing_code", "Authorization code is required")
		return
	}

	// Exchange the authorization code for OAuth tokens.
	oauthToken, err := provider.ExchangeCode(r.Context(), req.Code, req.CodeVerifier)
	if err != nil {
		h.respondError(w, http.StatusUnauthorized, "token_exchange_failed", "Failed to exchange authorization code")
		return
	}

	// Get user information from the OAuth provider.
	userInfo, err := provider.GetUserInfo(r.Context(), oauthToken.AccessToken)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "user_info_failed", "Failed to retrieve user information")
		return
	}

	// Find or create the user in the database.
	user, err := h.findOrCreateUser(r.Context(), providerType, userInfo)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "user_creation_failed", "Failed to create or update user")
		return
	}

	// Generate JWT tokens.
	accessToken, refreshToken, err := h.jwtService.GenerateTokens(user.ID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "token_generation_failed", "Failed to generate tokens")
		return
	}

	h.respondJSON(w, http.StatusOK, CallbackResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(auth.GetAccessTokenExpiry().Seconds()),
		User:         user,
	})
}

// Refresh handles POST /api/v1/auth/refresh.
// It refreshes the access token using a valid refresh token.
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.RefreshToken == "" {
		h.respondError(w, http.StatusBadRequest, "missing_token", "Refresh token is required")
		return
	}

	// Validate and refresh the tokens.
	accessToken, refreshToken, err := h.jwtService.RefreshTokens(req.RefreshToken)
	if err != nil {
		if errors.Is(err, auth.ErrExpiredToken) {
			h.respondError(w, http.StatusUnauthorized, "token_expired", "Refresh token has expired")
			return
		}
		if errors.Is(err, auth.ErrInvalidToken) || errors.Is(err, auth.ErrInvalidTokenType) {
			h.respondError(w, http.StatusUnauthorized, "invalid_token", "Invalid refresh token")
			return
		}
		h.respondError(w, http.StatusInternalServerError, "refresh_failed", "Failed to refresh token")
		return
	}

	h.respondJSON(w, http.StatusOK, RefreshResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(auth.GetAccessTokenExpiry().Seconds()),
	})
}

// Logout handles POST /api/v1/auth/logout.
// Currently, this is a no-op since we use stateless JWT tokens.
// In a production system, you might want to blacklist the token.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// For stateless JWT, logout is handled client-side by discarding the token.
	// A production implementation might add the token to a blacklist.
	h.respondJSON(w, http.StatusOK, model.SuccessResponse{
		Success: true,
	})
}

// findOrCreateUser looks up a user by provider ID, or creates a new user if not found.
func (h *AuthHandler) findOrCreateUser(
	ctx context.Context,
	providerType auth.ProviderType,
	userInfo *auth.UserInfo,
) (*model.User, error) {
	// Try to find existing user by provider ID.
	user, err := h.userRepo.GetByProviderID(ctx, string(providerType), userInfo.ID)
	if err == nil {
		// User found, update their information.
		user.Email = userInfo.Email
		user.Name = userInfo.Name
		user.Picture = userInfo.Picture
		if err := h.userRepo.Update(ctx, user); err != nil {
			return nil, err
		}
		return user, nil
	}

	// Check if the error is "not found" - if so, create a new user.
	if !errors.Is(err, repository.ErrUserNotFound) {
		return nil, err
	}

	// Create a new user.
	user = &model.User{
		ID:         uuid.New().String(),
		Email:      userInfo.Email,
		Name:       userInfo.Name,
		Picture:    userInfo.Picture,
		Provider:   string(providerType),
		ProviderID: userInfo.ID,
		Tier:       "free",
	}

	if err := h.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// respondJSON writes a JSON response with the given status code.
func (h *AuthHandler) respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// respondError writes a JSON error response with the given status code.
func (h *AuthHandler) respondError(w http.ResponseWriter, status int, errorCode, message string) {
	h.respondJSON(w, status, model.ErrorResponse{
		Error:   errorCode,
		Message: message,
	})
}

// RegisterRoutes registers the authentication routes on the given router.
func (h *AuthHandler) RegisterRoutes(r chi.Router) {
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/login/{provider}", h.Login)
		r.Post("/callback/{provider}", h.Callback)
		r.Post("/refresh", h.Refresh)
		r.Post("/logout", h.Logout)
	})
}
