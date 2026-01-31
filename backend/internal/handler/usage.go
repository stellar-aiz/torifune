package handler

import (
	"net/http"
	"strconv"

	"github.com/stellar/torifune/backend/internal/middleware"
	"github.com/stellar/torifune/backend/internal/repository"
)

// UsageHandler handles usage-related HTTP requests.
type UsageHandler struct {
	usageRepo repository.UsageRepository
}

// NewUsageHandler creates a new UsageHandler instance.
func NewUsageHandler(usageRepo repository.UsageRepository) *UsageHandler {
	return &UsageHandler{
		usageRepo: usageRepo,
	}
}

// CurrentUsageResponse represents the response for current month's usage.
type CurrentUsageResponse struct {
	// YearMonth is the year and month in "YYYYMM" format.
	YearMonth string `json:"yearMonth"`
	// ProcessedCount is the number of images processed this month.
	ProcessedCount int `json:"processedCount"`
	// FreeLimit is the monthly limit for free tier.
	FreeLimit int `json:"freeLimit"`
	// Remaining is the number of images remaining in the quota.
	Remaining int `json:"remaining"`
	// UsagePercentage is the usage as a percentage (0-100).
	UsagePercentage float64 `json:"usagePercentage"`
}

// UsageHistoryResponse represents the response for usage history.
type UsageHistoryResponse struct {
	// History contains monthly usage records, most recent first.
	History []MonthlyUsageRecord `json:"history"`
}

// MonthlyUsageRecord represents a single month's usage record.
type MonthlyUsageRecord struct {
	// YearMonth is the year and month in "YYYYMM" format.
	YearMonth string `json:"yearMonth"`
	// ProcessedCount is the number of images processed that month.
	ProcessedCount int `json:"processedCount"`
	// FreeLimit is the monthly limit that was in effect.
	FreeLimit int `json:"freeLimit"`
}

// GetCurrent handles GET /api/v1/usage/current.
// It returns the current month's usage for the authenticated user.
func (h *UsageHandler) GetCurrent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from JWT claims
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		writeErrorResponse(w, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	// Check for organization_id query parameter
	entityID := userID
	entityType := "user"
	if orgID := r.URL.Query().Get("organization_id"); orgID != "" {
		entityID = orgID
		entityType = "organization"
	}

	// Get current month's usage
	usage, err := h.usageRepo.GetCurrentMonth(ctx, entityID, entityType)
	if err != nil {
		writeErrorResponse(w, http.StatusInternalServerError, "internal_error", "Failed to get usage data")
		return
	}

	// Calculate remaining and percentage
	remaining := max(usage.FreeLimit-usage.ProcessedCount, 0)

	var usagePercentage float64
	if usage.FreeLimit > 0 {
		usagePercentage = float64(usage.ProcessedCount) / float64(usage.FreeLimit) * 100
		if usagePercentage > 100 {
			usagePercentage = 100
		}
	}

	response := CurrentUsageResponse{
		YearMonth:       usage.YearMonth,
		ProcessedCount:  usage.ProcessedCount,
		FreeLimit:       usage.FreeLimit,
		Remaining:       remaining,
		UsagePercentage: usagePercentage,
	}

	writeSuccessResponse(w, http.StatusOK, response)
}

// GetHistory handles GET /api/v1/usage/history.
// It returns usage history for the authenticated user.
func (h *UsageHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from JWT claims
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		writeErrorResponse(w, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	// Check for organization_id query parameter
	entityID := userID
	if orgID := r.URL.Query().Get("organization_id"); orgID != "" {
		entityID = orgID
	}

	// Get months parameter (default 12)
	months := 12
	if monthsStr := r.URL.Query().Get("months"); monthsStr != "" {
		if m, err := strconv.Atoi(monthsStr); err == nil && m > 0 && m <= 24 {
			months = m
		}
	}

	// Get usage history
	usages, err := h.usageRepo.GetHistory(ctx, entityID, months)
	if err != nil {
		writeErrorResponse(w, http.StatusInternalServerError, "internal_error", "Failed to get usage history")
		return
	}

	// Convert to response format
	history := make([]MonthlyUsageRecord, len(usages))
	for i, usage := range usages {
		history[i] = MonthlyUsageRecord{
			YearMonth:      usage.YearMonth,
			ProcessedCount: usage.ProcessedCount,
			FreeLimit:      usage.FreeLimit,
		}
	}

	response := UsageHistoryResponse{
		History: history,
	}

	writeSuccessResponse(w, http.StatusOK, response)
}
