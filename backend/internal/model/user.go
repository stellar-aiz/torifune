package model

import "time"

// User represents an authenticated user in the system.
type User struct {
	ID          string    `firestore:"id" json:"id"`
	Email       string    `firestore:"email" json:"email"`
	Name        string    `firestore:"name" json:"name"`
	Picture     string    `firestore:"picture" json:"picture"`
	Provider    string    `firestore:"provider" json:"provider"`       // "google", "microsoft", "slack"
	ProviderID  string    `firestore:"providerId" json:"providerId"`
	WorkspaceID string    `firestore:"workspaceId,omitempty" json:"workspaceId,omitempty"` // for Slack
	Tier        string    `firestore:"tier" json:"tier"`               // "free", "pro"
	CreatedAt   time.Time `firestore:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time `firestore:"updatedAt" json:"updatedAt"`
}

// Organization represents a company or team that groups users together.
type Organization struct {
	ID        string    `firestore:"id" json:"id"`
	Name      string    `firestore:"name" json:"name"`
	Domain    string    `firestore:"domain" json:"domain"`
	Tier      string    `firestore:"tier" json:"tier"`
	OwnerID   string    `firestore:"ownerId" json:"ownerId"`
	CreatedAt time.Time `firestore:"createdAt" json:"createdAt"`
	UpdatedAt time.Time `firestore:"updatedAt" json:"updatedAt"`
}
