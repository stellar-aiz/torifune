package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	// Slack OAuth v2 endpoints.
	slackAuthURL     = "https://slack.com/oauth/v2/authorize"
	slackTokenURL    = "https://slack.com/api/oauth.v2.access"
	slackUserInfoURL = "https://slack.com/api/users.identity"
)

// slackTokenResponse represents the response from Slack's token endpoint.
type slackTokenResponse struct {
	OK          bool   `json:"ok"`
	Error       string `json:"error,omitempty"`
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
	BotUserID   string `json:"bot_user_id,omitempty"`
	AppID       string `json:"app_id"`
	Team        struct {
		Name string `json:"name"`
		ID   string `json:"id"`
	} `json:"team"`
	AuthedUser struct {
		ID          string `json:"id"`
		Scope       string `json:"scope"`
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	} `json:"authed_user"`
	RefreshToken     string `json:"refresh_token,omitempty"`
	ExpiresIn        int    `json:"expires_in,omitempty"`
	RefreshExpiresIn int    `json:"refresh_expires_in,omitempty"`
}

// slackUserIdentityResponse represents the response from Slack's users.identity API.
type slackUserIdentityResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
	User  struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Email    string `json:"email"`
		Image24  string `json:"image_24"`
		Image32  string `json:"image_32"`
		Image48  string `json:"image_48"`
		Image72  string `json:"image_72"`
		Image192 string `json:"image_192"`
		Image512 string `json:"image_512"`
	} `json:"user"`
	Team struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"team"`
}

// SlackProvider implements the OAuthProvider interface for Slack OAuth.
type SlackProvider struct {
	clientID     string
	clientSecret string
	redirectURL  string
	scopes       []string
	userScopes   []string
}

// NewSlackProvider creates a new Slack OAuth provider.
func NewSlackProvider(clientID, clientSecret, redirectURL string) *SlackProvider {
	return &SlackProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURL:  redirectURL,
		// Bot scopes (for workspace-level permissions).
		scopes: []string{},
		// User scopes (for user-level permissions).
		userScopes: []string{
			"identity.basic",
			"identity.email",
			"identity.avatar",
		},
	}
}

// GetAuthURL returns the Slack OAuth authorization URL.
func (p *SlackProvider) GetAuthURL(state, codeChallenge string) string {
	params := url.Values{}
	params.Set("client_id", p.clientID)
	params.Set("redirect_uri", p.redirectURL)
	params.Set("state", state)

	if len(p.scopes) > 0 {
		params.Set("scope", strings.Join(p.scopes, ","))
	}
	if len(p.userScopes) > 0 {
		params.Set("user_scope", strings.Join(p.userScopes, ","))
	}

	// Add PKCE parameters if code challenge is provided.
	// Note: Slack supports PKCE with S256 method.
	if codeChallenge != "" {
		params.Set("code_challenge", codeChallenge)
		params.Set("code_challenge_method", "S256")
	}

	return slackAuthURL + "?" + params.Encode()
}

// ExchangeCode exchanges an authorization code for Slack OAuth tokens.
func (p *SlackProvider) ExchangeCode(ctx context.Context, code, codeVerifier string) (*OAuthToken, error) {
	data := url.Values{}
	data.Set("client_id", p.clientID)
	data.Set("client_secret", p.clientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", p.redirectURL)

	// Add code verifier for PKCE if provided.
	if codeVerifier != "" {
		data.Set("code_verifier", codeVerifier)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, slackTokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp slackTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	if !tokenResp.OK {
		return nil, fmt.Errorf("slack API error: %s", tokenResp.Error)
	}

	// Use the user's access token for user-level API calls.
	accessToken := tokenResp.AuthedUser.AccessToken
	if accessToken == "" {
		accessToken = tokenResp.AccessToken
	}

	// Calculate expiry time if provided.
	expiresAt := time.Time{}
	if tokenResp.ExpiresIn > 0 {
		expiresAt = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	}

	return &OAuthToken{
		AccessToken:  accessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

// GetUserInfo retrieves user information from Slack.
func (p *SlackProvider) GetUserInfo(ctx context.Context, accessToken string) (*UserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, slackUserInfoURL, nil)
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

	var userResp slackUserIdentityResponse
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	if !userResp.OK {
		return nil, fmt.Errorf("slack API error: %s", userResp.Error)
	}

	// Use the largest available profile picture.
	picture := userResp.User.Image512
	if picture == "" {
		picture = userResp.User.Image192
	}
	if picture == "" {
		picture = userResp.User.Image72
	}

	return &UserInfo{
		ID:      userResp.User.ID,
		Email:   userResp.User.Email,
		Name:    userResp.User.Name,
		Picture: picture,
	}, nil
}

// Ensure SlackProvider implements OAuthProvider.
var _ OAuthProvider = (*SlackProvider)(nil)
