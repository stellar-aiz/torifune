package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"cloud.google.com/go/firestore"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/stellar/torifune/backend/internal/config"
	"github.com/stellar/torifune/backend/internal/handler"
	"github.com/stellar/torifune/backend/internal/middleware"
	"github.com/stellar/torifune/backend/internal/repository"
	"github.com/stellar/torifune/backend/internal/service/auth"
)

func main() {
	// Load .env file (ignore error if not found, e.g., in production)
	_ = godotenv.Load()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load configuration: %v", err)
	}

	// Initialize Firestore client
	ctx := context.Background()
	firestoreClient, err := firestore.NewClient(ctx, cfg.GoogleProjectID)
	if err != nil {
		log.Fatalf("failed to create Firestore client: %v", err)
	}
	defer firestoreClient.Close()

	// Initialize repositories
	userRepo := repository.NewFirestoreUserRepository(firestoreClient)
	usageRepo := repository.NewFirestoreUsageRepository(firestoreClient, cfg.FreeTierLimit)

	// Initialize OAuth providers
	providers := make(map[auth.ProviderType]auth.OAuthProvider)

	// OAuth redirect URL base (backend callback endpoint)
	redirectURLBase := cfg.FrontendURL + "/api/v1/auth/callback"

	if cfg.HasGoogleOAuth() {
		providers[auth.ProviderGoogle] = auth.NewGoogleProvider(
			cfg.GoogleClientID,
			cfg.GoogleClientSecret,
			redirectURLBase+"/google",
		)
		log.Println("Google OAuth provider initialized")
	}

	if cfg.HasMicrosoftOAuth() {
		providers[auth.ProviderMicrosoft] = auth.NewMicrosoftProvider(
			cfg.MicrosoftClientID,
			cfg.MicrosoftClientSecret,
			cfg.MicrosoftTenantID,
			redirectURLBase+"/microsoft",
		)
		log.Println("Microsoft OAuth provider initialized")
	}

	if cfg.HasSlackOAuth() {
		providers[auth.ProviderSlack] = auth.NewSlackProvider(
			cfg.SlackClientID,
			cfg.SlackClientSecret,
			redirectURLBase+"/slack",
		)
		log.Println("Slack OAuth provider initialized")
	}

	// Initialize JWT service
	jwtService := auth.NewJWTService(cfg.JWTSecret, "torifune")

	// Initialize handlers
	authHandler := handler.NewAuthHandler(providers, jwtService, userRepo)
	ocrHandler := handler.NewOCRHandler(usageRepo, cfg.FreeTierLimit)
	usageHandler := handler.NewUsageHandler(usageRepo)

	// Initialize router
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)

	// CORS middleware
	r.Use(middleware.CORS(middleware.CORSConfig{
		AllowedOrigin: cfg.FrontendURL,
	}))

	// Rate limiting middleware
	r.Use(middleware.RateLimit(middleware.RateLimitConfig{
		RequestsPerMinute: 100,
	}))

	// JWT auth middleware with skip paths for auth endpoints and health check
	r.Use(middleware.Auth(middleware.AuthConfig{
		JWTSecret: cfg.JWTSecret,
		SkipPaths: []string{
			"/health",
			"/api/v1/auth/refresh",
			"/api/v1/auth/logout",
		},
		SkipPrefixes: []string{
			"/api/v1/auth/login/",
			"/api/v1/auth/callback/",
		},
	}))

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Register auth routes (login, callback, refresh, logout)
	authHandler.RegisterRoutes(r)

	// Register OCR routes
	r.Route("/api/v1/ocr", func(r chi.Router) {
		r.Post("/process", ocrHandler.Process)
		r.Post("/batch", ocrHandler.BatchProcess)
	})

	// Register usage routes
	r.Route("/api/v1/usage", func(r chi.Router) {
		r.Get("/current", usageHandler.GetCurrent)
		r.Get("/history", usageHandler.GetHistory)
	})

	// Determine port
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Project ID: %s", cfg.GoogleProjectID)
	log.Printf("Frontend URL: %s", cfg.FrontendURL)

	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server failed to start: %v", err)
	}
}
