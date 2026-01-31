package model

import "time"

// MonthlyUsage tracks the number of processed receipts for a user or organization
// within a specific month.
type MonthlyUsage struct {
	EntityID       string    `firestore:"entityId" json:"entityId"`
	EntityType     string    `firestore:"entityType" json:"entityType"` // "user", "organization"
	YearMonth      string    `firestore:"yearMonth" json:"yearMonth"`   // "202401"
	ProcessedCount int       `firestore:"processedCount" json:"processedCount"`
	FreeLimit      int       `firestore:"freeLimit" json:"freeLimit"`
	UpdatedAt      time.Time `firestore:"updatedAt" json:"updatedAt"`
}
