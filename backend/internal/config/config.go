package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration values for the application.
type Config struct {
	// Google Cloud settings
	GoogleProjectID       string
	GoogleLocation        string
	DocumentAIProcessorID string

	// Authentication
	JWTSecret string

	// CORS
	FrontendURL string

	// OAuth providers
	GoogleClientID     string
	GoogleClientSecret string

	MicrosoftClientID     string
	MicrosoftClientSecret string
	MicrosoftTenantID     string

	SlackClientID     string
	SlackClientSecret string

	// Application settings
	FreeTierLimit int
}

// Load reads configuration from environment variables.
// It returns an error if required variables are missing.
func Load() (*Config, error) {
	cfg := &Config{
		GoogleProjectID:       os.Getenv("GOOGLE_PROJECT_ID"),
		GoogleLocation:        getEnvOrDefault("GOOGLE_LOCATION", "us"),
		DocumentAIProcessorID: os.Getenv("DOCUMENT_AI_PROCESSOR_ID"),
		JWTSecret:             os.Getenv("JWT_SECRET"),
		FrontendURL:           os.Getenv("FRONTEND_URL"),
		GoogleClientID:        os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:    os.Getenv("GOOGLE_CLIENT_SECRET"),
		MicrosoftClientID:     os.Getenv("MICROSOFT_CLIENT_ID"),
		MicrosoftClientSecret: os.Getenv("MICROSOFT_CLIENT_SECRET"),
		MicrosoftTenantID:     os.Getenv("MICROSOFT_TENANT_ID"),
		SlackClientID:         os.Getenv("SLACK_CLIENT_ID"),
		SlackClientSecret:     os.Getenv("SLACK_CLIENT_SECRET"),
		FreeTierLimit:         getEnvAsIntOrDefault("FREE_TIER_LIMIT", 300),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// validate checks that all required configuration values are present.
func (c *Config) validate() error {
	var missing []string

	if c.GoogleProjectID == "" {
		missing = append(missing, "GOOGLE_PROJECT_ID")
	}
	if c.DocumentAIProcessorID == "" {
		missing = append(missing, "DOCUMENT_AI_PROCESSOR_ID")
	}
	if c.JWTSecret == "" {
		missing = append(missing, "JWT_SECRET")
	}
	if c.FrontendURL == "" {
		missing = append(missing, "FRONTEND_URL")
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required environment variables: %v", missing)
	}

	return nil
}

// HasGoogleOAuth returns true if Google OAuth is configured.
func (c *Config) HasGoogleOAuth() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != ""
}

// HasMicrosoftOAuth returns true if Microsoft OAuth is configured.
func (c *Config) HasMicrosoftOAuth() bool {
	return c.MicrosoftClientID != "" && c.MicrosoftClientSecret != "" && c.MicrosoftTenantID != ""
}

// HasSlackOAuth returns true if Slack OAuth is configured.
func (c *Config) HasSlackOAuth() bool {
	return c.SlackClientID != "" && c.SlackClientSecret != ""
}

// getEnvOrDefault returns the value of an environment variable,
// or a default value if the variable is not set.
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsIntOrDefault returns the value of an environment variable as an integer,
// or a default value if the variable is not set or cannot be parsed.
func getEnvAsIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
