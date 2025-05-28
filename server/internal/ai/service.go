package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

// Service represents the AI service interface
type Service interface {
	// GroupTabs groups tabs using AI and returns suggested groupings
	GroupTabs(ctx context.Context, req GroupTabsRequest) (GroupTabsResponse, error)

	// CheckQuota checks if a user has enough tokens
	CheckQuota(userID string) (int, bool)

	// UpdateQuota updates a user's token quota
	UpdateQuota(userID string, tokensUsed int) (int, error)
}

// service implements the Service interface
type service struct {
	client     openai.Client
	quotaLock  sync.RWMutex
	userQuotas map[string]int
}

// Default token quotas
const (
	DefaultFreeQuota = 10
)

// New creates a new AI service
func New() Service {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		panic("OPENAI_API_KEY environment variable is required")
	}

	client := openai.NewClient(
		option.WithAPIKey(apiKey),
	)

	return &service{
		client:     client,
		userQuotas: make(map[string]int),
	}
}

// GroupTabs groups tabs using AI and returns suggested groupings
func (s *service) GroupTabs(ctx context.Context, req GroupTabsRequest) (GroupTabsResponse, error) {
	// Prepare the tabs data for the AI prompt
	tabsData, err := json.Marshal(req.Tabs)
	if err != nil {
		return GroupTabsResponse{}, fmt.Errorf("error marshaling tabs data: %w", err)
	}

	// Construct the prompt for OpenAI
	prompt := fmt.Sprintf(`You are a browser tab organizer. Your task is to group the following browser tabs into logical categories.

Tab data: %s

Output ONLY valid JSON that follows this exact format:
{
  "groups": [
    {
      "group_name": "Category Name",
      "tab_ids": [tab_id_1, tab_id_2, ...]
    },
    ...
  ]
}

Rules:
1. Each tab should be assigned to exactly one group
2. Create meaningful group names based on tab content/URLs
3. Use 2-5 groups depending on tab similarity
4. Do not include any explanation or text outside of the JSON`,
		string(tabsData))

	// Make the API call to OpenAI
	chatCompletion, err := s.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage(prompt),
		},
		Model: openai.ChatModelGPT4o,
	})
	if err != nil {
		return GroupTabsResponse{}, fmt.Errorf("error calling OpenAI API: %w", err)
	}

	// Extract the response content
	content := chatCompletion.Choices[0].Message.Content

	// Parse the JSON response from OpenAI
	var result struct {
		Groups []TabGroup `json:"groups"`
	}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return GroupTabsResponse{}, fmt.Errorf("error parsing OpenAI response: %w", err)
	}

	// Update the user's quota
	tokensUsed := 1 // For simplicity, we count each request as 1 token
	tokensRemaining, err := s.UpdateQuota(req.UserID, tokensUsed)
	if err != nil {
		return GroupTabsResponse{}, fmt.Errorf("error updating quota: %w", err)
	}

	// Return the response
	return GroupTabsResponse{
		Groups: result.Groups,
		Usage: UsageInfo{
			TokensUsed:      tokensUsed,
			TokensRemaining: tokensRemaining,
		},
	}, nil
}

// CheckQuota checks if a user has enough tokens
func (s *service) CheckQuota(userID string) (int, bool) {
	// If no user ID is provided, use a default quota for anonymous users
	if userID == "" {
		return DefaultFreeQuota, true
	}

	s.quotaLock.RLock()
	defer s.quotaLock.RUnlock()

	// Get the user's remaining tokens, default to DefaultFreeQuota if not found
	remainingTokens, exists := s.userQuotas[userID]
	if !exists {
		remainingTokens = DefaultFreeQuota
	}

	// Check if the user has enough tokens
	return remainingTokens, remainingTokens > 0
}

// UpdateQuota updates a user's token quota
func (s *service) UpdateQuota(userID string, tokensUsed int) (int, error) {
	// If no user ID is provided, don't update any quota
	if userID == "" {
		return DefaultFreeQuota - tokensUsed, nil
	}

	s.quotaLock.Lock()
	defer s.quotaLock.Unlock()

	// Get the current quota, default to DefaultFreeQuota if not found
	currentQuota, exists := s.userQuotas[userID]
	if !exists {
		currentQuota = DefaultFreeQuota
	}

	// Update the quota
	remainingTokens := currentQuota - tokensUsed
	if remainingTokens < 0 {
		remainingTokens = 0
	}
	s.userQuotas[userID] = remainingTokens

	return remainingTokens, nil
}
