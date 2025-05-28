package ai

import (
	"context"
	"errors"
	"log"
	"os"
	"sync"
)

// Service defines the interface for the AI service
type Service interface {
	// GroupTabs groups tabs based on their content using AI
	GroupTabs(ctx context.Context, req GroupTabsRequest) (GroupTabsResponse, error)

	// CheckQuota checks if a user has sufficient quota for AI operations
	CheckQuota(userID string) (int, bool)

	// UpdateQuota updates a user's quota after an AI operation
	UpdateQuota(userID string, tokensUsed int) (int, error)
}

// service is the implementation of the AI Service
type service struct {
	// OpenAI client for making API calls
	openAI OpenAIClient

	// In-memory quota store (for development/testing)
	// In production, this would be stored in a database
	quotaMu sync.RWMutex
	quotas  map[string]int

	// Default tokens for new users
	defaultTokens int
}

// New creates a new instance of the AI service
func New() Service {
	// Initialize the OpenAI client
	openAIKey := os.Getenv("OPENAI_API_KEY")
	if openAIKey == "" {
		log.Println("WARNING: OPENAI_API_KEY not set, AI grouping will not work")
	}

	// Default tokens for free users
	defaultTokens := 10

	return &service{
		openAI:        NewOpenAIClient(openAIKey),
		quotas:        make(map[string]int),
		defaultTokens: defaultTokens,
	}
}

// GroupTabs groups tabs based on their content using AI
func (s *service) GroupTabs(ctx context.Context, req GroupTabsRequest) (GroupTabsResponse, error) {
	// Check if user has quota
	_, hasQuota := s.CheckQuota(req.UserID)
	if !hasQuota {
		return GroupTabsResponse{}, errors.New("insufficient quota")
	}

	// Use OpenAI to group the tabs
	groups, tokensUsed, err := s.openAI.GroupTabs(ctx, req.Tabs)
	if err != nil {
		return GroupTabsResponse{}, err
	}

	// Update user's quota
	remainingTokens, err := s.UpdateQuota(req.UserID, tokensUsed)
	if err != nil {
		log.Printf("Error updating quota for user %s: %v", req.UserID, err)
		// Continue anyway, don't fail the request
	}

	// Return the response
	return GroupTabsResponse{
		Groups: groups,
		Usage: UsageInfo{
			TokensUsed:      tokensUsed,
			TokensRemaining: remainingTokens,
		},
	}, nil
}

// CheckQuota checks if a user has sufficient quota for AI operations
func (s *service) CheckQuota(userID string) (int, bool) {
	s.quotaMu.RLock()
	defer s.quotaMu.RUnlock()

	// If user doesn't exist in the quota map, initialize with default tokens
	tokens, exists := s.quotas[userID]
	if !exists {
		s.quotaMu.RUnlock()
		s.quotaMu.Lock()
		// Double-check after acquiring write lock
		if _, exists = s.quotas[userID]; !exists {
			s.quotas[userID] = s.defaultTokens
			tokens = s.defaultTokens
		}
		s.quotaMu.Unlock()
		s.quotaMu.RLock()
	}

	return tokens, tokens > 0
}

// UpdateQuota updates a user's quota after an AI operation
func (s *service) UpdateQuota(userID string, tokensUsed int) (int, error) {
	s.quotaMu.Lock()
	defer s.quotaMu.Unlock()

	// If user doesn't exist, initialize with default tokens
	if _, exists := s.quotas[userID]; !exists {
		s.quotas[userID] = s.defaultTokens
	}

	// Decrement tokens
	if s.quotas[userID] < tokensUsed {
		return 0, errors.New("insufficient tokens")
	}

	s.quotas[userID] -= tokensUsed
	return s.quotas[userID], nil
}
