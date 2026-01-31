package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	// Token expiration durations.
	accessTokenExpiry  = 15 * time.Minute
	refreshTokenExpiry = 7 * 24 * time.Hour // 7 days
)

// TokenType represents the type of JWT token.
type TokenType string

const (
	// TokenTypeAccess represents an access token.
	TokenTypeAccess TokenType = "access"

	// TokenTypeRefresh represents a refresh token.
	TokenTypeRefresh TokenType = "refresh"
)

// Common JWT errors.
var (
	ErrInvalidToken     = errors.New("invalid token")
	ErrExpiredToken     = errors.New("token has expired")
	ErrInvalidTokenType = errors.New("invalid token type")
)

// Claims represents the custom claims for JWT tokens.
type Claims struct {
	jwt.RegisteredClaims
	UserID    string    `json:"user_id"`
	TokenType TokenType `json:"token_type"`
}

// JWTService handles JWT token generation and validation.
type JWTService struct {
	secretKey []byte
	issuer    string
}

// NewJWTService creates a new JWT service.
func NewJWTService(secretKey, issuer string) *JWTService {
	return &JWTService{
		secretKey: []byte(secretKey),
		issuer:    issuer,
	}
}

// GenerateTokens generates both access and refresh tokens for a user.
func (s *JWTService) GenerateTokens(userID string) (accessToken, refreshToken string, err error) {
	accessToken, err = s.generateToken(userID, TokenTypeAccess, accessTokenExpiry)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err = s.generateToken(userID, TokenTypeRefresh, refreshTokenExpiry)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return accessToken, refreshToken, nil
}

// generateToken creates a JWT token with the specified parameters.
func (s *JWTService) generateToken(userID string, tokenType TokenType, expiry time.Duration) (string, error) {
	now := time.Now()
	claims := &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(expiry)),
			NotBefore: jwt.NewNumericDate(now),
		},
		UserID:    userID,
		TokenType: tokenType,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

// ValidateToken validates a JWT token and returns the claims.
func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate the signing method.
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.secretKey, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// ValidateAccessToken validates an access token.
func (s *JWTService) ValidateAccessToken(tokenString string) (*Claims, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != TokenTypeAccess {
		return nil, ErrInvalidTokenType
	}

	return claims, nil
}

// ValidateRefreshToken validates a refresh token.
func (s *JWTService) ValidateRefreshToken(tokenString string) (*Claims, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != TokenTypeRefresh {
		return nil, ErrInvalidTokenType
	}

	return claims, nil
}

// RefreshTokens validates a refresh token and generates new access and refresh tokens.
func (s *JWTService) RefreshTokens(refreshToken string) (accessToken, newRefreshToken string, err error) {
	claims, err := s.ValidateRefreshToken(refreshToken)
	if err != nil {
		return "", "", fmt.Errorf("invalid refresh token: %w", err)
	}

	return s.GenerateTokens(claims.UserID)
}

// GetAccessTokenExpiry returns the access token expiration duration.
func GetAccessTokenExpiry() time.Duration {
	return accessTokenExpiry
}

// GetRefreshTokenExpiry returns the refresh token expiration duration.
func GetRefreshTokenExpiry() time.Duration {
	return refreshTokenExpiry
}
