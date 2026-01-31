// Package auth provides OAuth authentication services for multiple providers.
package auth

import (
	"context"
	"time"
)

// OAuthProvider defines the interface for OAuth authentication providers.
type OAuthProvider interface {
	// GetAuthURL returns the authorization URL for the OAuth flow.
	// state is used for CSRF protection.
	// codeChallenge is used for PKCE (Proof Key for Code Exchange).
	GetAuthURL(state, codeChallenge string) string

	// ExchangeCode exchanges an authorization code for tokens.
	// code is the authorization code received from the OAuth provider.
	// codeVerifier is the original random string used to generate the code challenge.
	ExchangeCode(ctx context.Context, code, codeVerifier string) (*OAuthToken, error)

	// GetUserInfo retrieves user information using the access token.
	GetUserInfo(ctx context.Context, accessToken string) (*UserInfo, error)
}

// OAuthToken represents the tokens received from an OAuth provider.
type OAuthToken struct {
	// AccessToken is used to authenticate API requests.
	AccessToken string

	// RefreshToken is used to obtain new access tokens.
	RefreshToken string

	// ExpiresAt is when the access token expires.
	ExpiresAt time.Time
}

// UserInfo represents the user information retrieved from an OAuth provider.
type UserInfo struct {
	// ID is the unique identifier for the user from the provider.
	ID string

	// Email is the user's email address.
	Email string

	// Name is the user's display name.
	Name string

	// Picture is the URL to the user's profile picture.
	Picture string
}

// ProviderType represents the type of OAuth provider.
type ProviderType string

const (
	// ProviderGoogle represents Google OAuth.
	ProviderGoogle ProviderType = "google"

	// ProviderMicrosoft represents Microsoft (Azure AD) OAuth.
	ProviderMicrosoft ProviderType = "microsoft"

	// ProviderSlack represents Slack OAuth.
	ProviderSlack ProviderType = "slack"
)
