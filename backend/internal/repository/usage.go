package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/stellar/torifune/backend/internal/model"
)

// ErrUsageNotFound is returned when usage data is not found.
var ErrUsageNotFound = errors.New("usage not found")

// UsageRepository defines the interface for usage data operations.
type UsageRepository interface {
	// GetCurrentMonth retrieves the usage for the current month.
	GetCurrentMonth(ctx context.Context, entityID, entityType string) (*model.MonthlyUsage, error)

	// IncrementCount increments the processed count for the current month.
	IncrementCount(ctx context.Context, entityID, entityType string, count int) error

	// GetHistory retrieves usage history for the specified number of months.
	GetHistory(ctx context.Context, entityID string, months int) ([]model.MonthlyUsage, error)
}

// FirestoreUsageRepository implements UsageRepository using Firestore.
type FirestoreUsageRepository struct {
	client       *firestore.Client
	collection   string
	freeTierLimit int
}

// NewFirestoreUsageRepository creates a new FirestoreUsageRepository.
func NewFirestoreUsageRepository(client *firestore.Client, freeTierLimit int) *FirestoreUsageRepository {
	return &FirestoreUsageRepository{
		client:       client,
		collection:   "monthly_usage",
		freeTierLimit: freeTierLimit,
	}
}

// documentID generates a unique document ID for a usage record.
func (r *FirestoreUsageRepository) documentID(entityID, entityType, yearMonth string) string {
	return fmt.Sprintf("%s_%s_%s", entityType, entityID, yearMonth)
}

// currentYearMonth returns the current year and month in "YYYYMM" format.
func currentYearMonth() string {
	return time.Now().Format("200601")
}

// GetCurrentMonth retrieves the usage for the current month.
func (r *FirestoreUsageRepository) GetCurrentMonth(ctx context.Context, entityID, entityType string) (*model.MonthlyUsage, error) {
	yearMonth := currentYearMonth()
	docID := r.documentID(entityID, entityType, yearMonth)

	doc, err := r.client.Collection(r.collection).Doc(docID).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			// Return a new usage record with zero count
			return &model.MonthlyUsage{
				EntityID:       entityID,
				EntityType:     entityType,
				YearMonth:      yearMonth,
				ProcessedCount: 0,
				FreeLimit:      r.freeTierLimit,
				UpdatedAt:      time.Now(),
			}, nil
		}
		return nil, err
	}

	var usage model.MonthlyUsage
	if err := doc.DataTo(&usage); err != nil {
		return nil, err
	}

	return &usage, nil
}

// IncrementCount increments the processed count for the current month.
func (r *FirestoreUsageRepository) IncrementCount(ctx context.Context, entityID, entityType string, count int) error {
	yearMonth := currentYearMonth()
	docID := r.documentID(entityID, entityType, yearMonth)
	docRef := r.client.Collection(r.collection).Doc(docID)

	return r.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		doc, err := tx.Get(docRef)
		if err != nil {
			if status.Code(err) == codes.NotFound {
				// Create new usage record
				usage := model.MonthlyUsage{
					EntityID:       entityID,
					EntityType:     entityType,
					YearMonth:      yearMonth,
					ProcessedCount: count,
					FreeLimit:      r.freeTierLimit,
					UpdatedAt:      time.Now(),
				}
				return tx.Set(docRef, usage)
			}
			return err
		}

		var usage model.MonthlyUsage
		if err := doc.DataTo(&usage); err != nil {
			return err
		}

		usage.ProcessedCount += count
		usage.UpdatedAt = time.Now()

		return tx.Set(docRef, usage)
	})
}

// GetHistory retrieves usage history for the specified number of months.
func (r *FirestoreUsageRepository) GetHistory(ctx context.Context, entityID string, months int) ([]model.MonthlyUsage, error) {
	// Calculate the year-months we need to query
	yearMonths := make([]string, months)
	now := time.Now()
	for i := 0; i < months; i++ {
		t := now.AddDate(0, -i, 0)
		yearMonths[i] = t.Format("200601")
	}

	// Query for all matching documents
	query := r.client.Collection(r.collection).
		Where("entityId", "==", entityID).
		Where("yearMonth", "in", yearMonths).
		OrderBy("yearMonth", firestore.Desc)

	docs, err := query.Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	usages := make([]model.MonthlyUsage, 0, len(docs))
	for _, doc := range docs {
		var usage model.MonthlyUsage
		if err := doc.DataTo(&usage); err != nil {
			return nil, err
		}
		usages = append(usages, usage)
	}

	return usages, nil
}
