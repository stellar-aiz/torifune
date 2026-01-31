package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/stellar/torifune/backend/internal/middleware"
	"github.com/stellar/torifune/backend/internal/model"
	"github.com/stellar/torifune/backend/internal/repository"
)

// OCRHandler handles OCR-related HTTP requests.
type OCRHandler struct {
	usageRepo     repository.UsageRepository
	freeTierLimit int
}

// NewOCRHandler creates a new OCRHandler instance.
func NewOCRHandler(usageRepo repository.UsageRepository, freeTierLimit int) *OCRHandler {
	return &OCRHandler{
		usageRepo:     usageRepo,
		freeTierLimit: freeTierLimit,
	}
}

// ProcessRequest represents a request to process a single image or PDF.
type ProcessRequest struct {
	// ImageData is the base64-encoded image or PDF data.
	ImageData string `json:"imageData"`
	// MimeType is the MIME type of the file (e.g., "image/png", "application/pdf").
	MimeType string `json:"mimeType"`
	// OrganizationID is optional; if provided, usage is tracked at org level.
	OrganizationID string `json:"organizationId,omitempty"`
}

// ProcessResponse represents the response from OCR processing.
type ProcessResponse struct {
	// Text is the extracted text from the document.
	Text string `json:"text"`
	// Confidence is the overall confidence score (0-1).
	Confidence float64 `json:"confidence"`
	// Fields contains structured field extraction results.
	Fields map[string]any `json:"fields,omitempty"`
}

// BatchProcessRequest represents a request to process multiple images or PDFs.
type BatchProcessRequest struct {
	// Items is a list of items to process.
	Items []ProcessRequest `json:"items"`
	// OrganizationID is optional; if provided, usage is tracked at org level.
	OrganizationID string `json:"organizationId,omitempty"`
}

// BatchProcessResponse represents the response from batch OCR processing.
type BatchProcessResponse struct {
	// Results contains the OCR results for each item.
	Results []ProcessResponse `json:"results"`
	// FailedIndices contains indices of items that failed processing.
	FailedIndices []int `json:"failedIndices,omitempty"`
}

// Process handles POST /api/v1/ocr/process.
// It processes a single image or PDF with OCR.
func (h *OCRHandler) Process(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from JWT claims
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		writeErrorResponse(w, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	// Parse request body
	var req ProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErrorResponse(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	defer r.Body.Close()

	// Validate request
	if req.ImageData == "" {
		writeErrorResponse(w, http.StatusBadRequest, "invalid_request", "imageData is required")
		return
	}
	if req.MimeType == "" {
		writeErrorResponse(w, http.StatusBadRequest, "invalid_request", "mimeType is required")
		return
	}

	// Determine entity for usage tracking (organization or user)
	entityID := userID
	entityType := "user"
	if req.OrganizationID != "" {
		entityID = req.OrganizationID
		entityType = "organization"
	}

	// Check usage limits
	usage, err := h.usageRepo.GetCurrentMonth(ctx, entityID, entityType)
	if err != nil {
		writeErrorResponse(w, http.StatusInternalServerError, "internal_error", "Failed to check usage")
		return
	}

	if usage.ProcessedCount >= usage.FreeLimit {
		writeErrorResponse(w, http.StatusPaymentRequired, "usage_limit_exceeded",
			"Monthly usage limit exceeded. Please upgrade your plan.")
		return
	}

	// TODO: Perform actual OCR processing using Document AI
	// For now, return a placeholder response
	response := ProcessResponse{
		Text:       "OCR processing placeholder - implement Document AI integration",
		Confidence: 0.0,
		Fields:     make(map[string]any),
	}

	// Increment usage count after successful processing
	if err := h.usageRepo.IncrementCount(ctx, entityID, entityType, 1); err != nil {
		// Log error but don't fail the request since OCR was successful
		// In production, consider using a background job for more reliable tracking
	}

	writeSuccessResponse(w, http.StatusOK, response)
}

// BatchProcess handles POST /api/v1/ocr/batch.
// It processes multiple images or PDFs with OCR.
func (h *OCRHandler) BatchProcess(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from JWT claims
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		writeErrorResponse(w, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	// Parse request body
	body, err := io.ReadAll(io.LimitReader(r.Body, 100*1024*1024)) // 100MB limit
	if err != nil {
		writeErrorResponse(w, http.StatusBadRequest, "invalid_request", "Failed to read request body")
		return
	}
	defer r.Body.Close()

	var req BatchProcessRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeErrorResponse(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	// Validate request
	if len(req.Items) == 0 {
		writeErrorResponse(w, http.StatusBadRequest, "invalid_request", "At least one item is required")
		return
	}

	const maxBatchSize = 100
	if len(req.Items) > maxBatchSize {
		writeErrorResponse(w, http.StatusBadRequest, "invalid_request",
			"Batch size exceeds maximum of 100 items")
		return
	}

	// Determine entity for usage tracking (organization or user)
	entityID := userID
	entityType := "user"
	if req.OrganizationID != "" {
		entityID = req.OrganizationID
		entityType = "organization"
	}

	// Check usage limits
	usage, err := h.usageRepo.GetCurrentMonth(ctx, entityID, entityType)
	if err != nil {
		writeErrorResponse(w, http.StatusInternalServerError, "internal_error", "Failed to check usage")
		return
	}

	itemCount := len(req.Items)
	if usage.ProcessedCount+itemCount > usage.FreeLimit {
		remaining := usage.FreeLimit - usage.ProcessedCount
		if remaining <= 0 {
			writeErrorResponse(w, http.StatusPaymentRequired, "usage_limit_exceeded",
				"Monthly usage limit exceeded. Please upgrade your plan.")
		} else {
			writeErrorResponse(w, http.StatusPaymentRequired, "usage_limit_exceeded",
				"Batch size exceeds remaining monthly quota. "+
					"You have "+string(rune(remaining))+" images remaining this month.")
		}
		return
	}

	// TODO: Perform actual batch OCR processing using Document AI
	// For now, return placeholder responses
	results := make([]ProcessResponse, len(req.Items))
	var failedIndices []int

	for i := range req.Items {
		// Validate each item
		if req.Items[i].ImageData == "" || req.Items[i].MimeType == "" {
			failedIndices = append(failedIndices, i)
			continue
		}

		results[i] = ProcessResponse{
			Text:       "OCR processing placeholder - implement Document AI integration",
			Confidence: 0.0,
			Fields:     make(map[string]any),
		}
	}

	// Calculate successful count
	successCount := len(req.Items) - len(failedIndices)

	// Increment usage count for successfully processed items
	if successCount > 0 {
		if err := h.usageRepo.IncrementCount(ctx, entityID, entityType, successCount); err != nil {
			// Log error but don't fail the request since OCR was successful
		}
	}

	response := BatchProcessResponse{
		Results:       results,
		FailedIndices: failedIndices,
	}

	writeSuccessResponse(w, http.StatusOK, response)
}

// writeErrorResponse writes a JSON error response.
func writeErrorResponse(w http.ResponseWriter, statusCode int, errorType, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(model.ErrorResponse{
		Error:   errorType,
		Message: message,
	})
}

// writeSuccessResponse writes a JSON success response.
func writeSuccessResponse(w http.ResponseWriter, statusCode int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(model.SuccessResponse{
		Success: true,
		Data:    data,
	})
}
