package model

// ErrorResponse represents an error response returned to clients.
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// SuccessResponse represents a successful response returned to clients.
type SuccessResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
}
