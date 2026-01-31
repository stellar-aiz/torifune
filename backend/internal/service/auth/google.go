package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	googleUserInfoURL = "https://www.googleapis.com/oauth2/v2/userinfo"
)

// googleUserInfoResponse represents the response from Google's userinfo endpoint.
type googleUserInfoResponse struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
	Locale        string `json:"locale"`
}

// GoogleProvider implements the OAuthProvider interface for Google OAuth.
type GoogleProvider struct {
	config *oauth2.Config
}

// NewGoogleProvider creates a new Google OAuth provider.
func NewGoogleProvider(clientID, clientSecret, redirectURL string) *GoogleProvider {
	return &GoogleProvider{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes: []string{
				"openid",
				"email",
				"profile",
			},
			Endpoint: google.Endpoint,
		},
	}
}

// GetAuthURL returns the Google OAuth authorization URL.
func (p *GoogleProvider) GetAuthURL(state, codeChallenge string) string {
	opts := []oauth2.AuthCodeOption{
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("prompt", "consent"),
	}

	// Add PKCE parameters if code challenge is provided.
	if codeChallenge != "" {
		opts = append(opts,
			oauth2.SetAuthURLParam("code_challenge", codeChallenge),
			oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		)
	}

	return p.config.AuthCodeURL(state, opts...)
}

// ExchangeCode exchanges an authorization code for Google OAuth tokens.
func (p *GoogleProvider) ExchangeCode(ctx context.Context, code, codeVerifier string) (*OAuthToken, error) {
	opts := []oauth2.AuthCodeOption{}

	// Add code verifier for PKCE if provided.
	if codeVerifier != "" {
		opts = append(opts, oauth2.SetAuthURLParam("code_verifier", codeVerifier))
	}

	token, err := p.config.Exchange(ctx, code, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}

	return &OAuthToken{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		ExpiresAt:    token.Expiry,
	}, nil
}

// GetUserInfo retrieves user information from Google.
func (p *GoogleProvider) GetUserInfo(ctx context.Context, accessToken string) (*UserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	var userInfo googleUserInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &UserInfo{
		ID:      userInfo.ID,
		Email:   userInfo.Email,
		Name:    userInfo.Name,
		Picture: userInfo.Picture,
	}, nil
}

// Ensure GoogleProvider implements OAuthProvider.
var _ OAuthProvider = (*GoogleProvider)(nil)
