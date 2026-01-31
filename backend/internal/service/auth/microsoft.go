package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"
)

const (
	// Microsoft Graph API endpoint for user info.
	microsoftGraphUserInfoURL = "https://graph.microsoft.com/v1.0/me"
)

// microsoftUserInfoResponse represents the response from Microsoft Graph API.
type microsoftUserInfoResponse struct {
	ID                string `json:"id"`
	DisplayName       string `json:"displayName"`
	GivenName         string `json:"givenName"`
	Surname           string `json:"surname"`
	UserPrincipalName string `json:"userPrincipalName"`
	Mail              string `json:"mail"`
}

// MicrosoftProvider implements the OAuthProvider interface for Microsoft (Azure AD) OAuth.
type MicrosoftProvider struct {
	config   *oauth2.Config
	tenantID string
}

// NewMicrosoftProvider creates a new Microsoft OAuth provider.
func NewMicrosoftProvider(clientID, clientSecret, tenantID, redirectURL string) *MicrosoftProvider {
	// Use "common" for multi-tenant apps, or specific tenant ID for single-tenant.
	if tenantID == "" {
		tenantID = "common"
	}

	return &MicrosoftProvider{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes: []string{
				"openid",
				"email",
				"profile",
				"User.Read",
			},
			Endpoint: oauth2.Endpoint{
				AuthURL:  fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/authorize", tenantID),
				TokenURL: fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenantID),
			},
		},
		tenantID: tenantID,
	}
}

// GetAuthURL returns the Microsoft OAuth authorization URL.
func (p *MicrosoftProvider) GetAuthURL(state, codeChallenge string) string {
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

// ExchangeCode exchanges an authorization code for Microsoft OAuth tokens.
func (p *MicrosoftProvider) ExchangeCode(ctx context.Context, code, codeVerifier string) (*OAuthToken, error) {
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

// GetUserInfo retrieves user information from Microsoft Graph API.
func (p *MicrosoftProvider) GetUserInfo(ctx context.Context, accessToken string) (*UserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, microsoftGraphUserInfoURL, nil)
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

	var userInfo microsoftUserInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	// Use mail if available, otherwise fall back to userPrincipalName.
	email := userInfo.Mail
	if email == "" {
		email = userInfo.UserPrincipalName
	}

	// Construct profile picture URL (requires additional permissions).
	pictureURL := fmt.Sprintf("https://graph.microsoft.com/v1.0/me/photo/$value")

	return &UserInfo{
		ID:      userInfo.ID,
		Email:   email,
		Name:    userInfo.DisplayName,
		Picture: pictureURL,
	}, nil
}

// Ensure MicrosoftProvider implements OAuthProvider.
var _ OAuthProvider = (*MicrosoftProvider)(nil)
