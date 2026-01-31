package repository

import (
	"context"
	"errors"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/stellar/torifune/backend/internal/model"
)

// ErrUserNotFound is returned when a user is not found.
var ErrUserNotFound = errors.New("user not found")

// UserRepository defines the interface for user data operations.
type UserRepository interface {
	// GetByID retrieves a user by their unique ID.
	GetByID(ctx context.Context, id string) (*model.User, error)

	// GetByProviderID retrieves a user by their OAuth provider and provider-specific ID.
	GetByProviderID(ctx context.Context, provider, providerID string) (*model.User, error)

	// Create creates a new user in the database.
	Create(ctx context.Context, user *model.User) error

	// Update updates an existing user in the database.
	Update(ctx context.Context, user *model.User) error
}

// FirestoreUserRepository implements UserRepository using Firestore.
type FirestoreUserRepository struct {
	client     *firestore.Client
	collection string
}

// NewFirestoreUserRepository creates a new FirestoreUserRepository.
func NewFirestoreUserRepository(client *firestore.Client) *FirestoreUserRepository {
	return &FirestoreUserRepository{
		client:     client,
		collection: "users",
	}
}

// GetByID retrieves a user by their unique ID.
func (r *FirestoreUserRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	doc, err := r.client.Collection(r.collection).Doc(id).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	var user model.User
	if err := doc.DataTo(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// GetByProviderID retrieves a user by their OAuth provider and provider-specific ID.
func (r *FirestoreUserRepository) GetByProviderID(ctx context.Context, provider, providerID string) (*model.User, error) {
	query := r.client.Collection(r.collection).
		Where("provider", "==", provider).
		Where("providerId", "==", providerID).
		Limit(1)

	docs, err := query.Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	if len(docs) == 0 {
		return nil, ErrUserNotFound
	}

	var user model.User
	if err := docs[0].DataTo(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// Create creates a new user in the database.
func (r *FirestoreUserRepository) Create(ctx context.Context, user *model.User) error {
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	_, err := r.client.Collection(r.collection).Doc(user.ID).Set(ctx, user)
	return err
}

// Update updates an existing user in the database.
func (r *FirestoreUserRepository) Update(ctx context.Context, user *model.User) error {
	user.UpdatedAt = time.Now()

	_, err := r.client.Collection(r.collection).Doc(user.ID).Set(ctx, user)
	return err
}
