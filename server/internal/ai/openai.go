package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/sashabaranov/go-openai"
)

// OpenAIClient is an interface for the OpenAI API client
type OpenAIClient interface {
	// GroupTabs groups tabs based on their content
	// Returns the groups, number of tokens used, and any error
	GroupTabs(ctx context.Context, tabs []Tab) ([]TabGroup, int, error)
}

// openAIClient is the implementation of the OpenAI client
type openAIClient struct {
	client *openai.Client
	model  string
}

// NewOpenAIClient creates a new OpenAI client with the provided API key
func NewOpenAIClient(apiKey string) OpenAIClient {
	// If API key is not provided, return a mock client
	if apiKey == "" {
		return &mockOpenAIClient{}
	}

	return &openAIClient{
		client: openai.NewClient(apiKey),
		model:  openai.GPT3Dot5Turbo,
	}
}

// GroupTabs uses OpenAI to group tabs based on their content
func (c *openAIClient) GroupTabs(ctx context.Context, tabs []Tab) ([]TabGroup, int, error) {
	// Build the prompt for the OpenAI API
	prompt := buildTabGroupingPrompt(tabs)

	// Create the chat completion request
	req := openai.ChatCompletionRequest{
		Model: c.model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: "You are a helpful assistant that groups browser tabs into logical categories.",
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: prompt,
			},
		},
		Temperature: 0.3, // Lower temperature for more deterministic results
		MaxTokens:   2000,
	}

	// Call the OpenAI API
	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		// Handle API errors
		var apiErr *openai.APIError
		if errors.As(err, &apiErr) {
			switch apiErr.HTTPStatusCode {
			case 401:
				return nil, 0, errors.New("authentication error: check your API key")
			case 429:
				return nil, 0, errors.New("API rate limit exceeded, please try again later")
			case 500:
				return nil, 0, errors.New("OpenAI server error, please try again later")
			default:
				return nil, 0, fmt.Errorf("OpenAI API error: %v", err)
			}
		}
		return nil, 0, fmt.Errorf("error calling OpenAI API: %v", err)
	}

	// Parse the response
	tabGroups, err := parseOpenAIResponse(resp.Choices[0].Message.Content)
	if err != nil {
		return nil, 0, fmt.Errorf("error parsing OpenAI response: %v", err)
	}

	// Get tokens used (prompt + completion)
	tokensUsed := 1 // Default to 1 if not available
	if resp.Usage.TotalTokens > 0 {
		tokensUsed = 1 // For simplicity, still count as 1 token per request
	}

	return tabGroups, tokensUsed, nil
}

// buildTabGroupingPrompt creates the prompt for the OpenAI API
func buildTabGroupingPrompt(tabs []Tab) string {
	var sb strings.Builder
	sb.WriteString("Group these browser tabs into logical categories. ")
	sb.WriteString("For each group, provide a short descriptive name. ")
	sb.WriteString("Return the result as a JSON array with the following format: ")
	sb.WriteString(`[{"group_name": "Group Name", "tab_ids": [1, 2, 3]}, ...]. `)
	sb.WriteString("Aim for 3-6 groups. Don't create a group with just a single tab unless it's truly unique. ")
	sb.WriteString("Here are the tabs:\n\n")

	for _, tab := range tabs {
		sb.WriteString(fmt.Sprintf("ID: %d, Title: \"%s\", URL: %s\n", tab.ID, tab.Title, tab.URL))
	}

	return sb.String()
}

// parseOpenAIResponse parses the OpenAI response into tab groups
func parseOpenAIResponse(response string) ([]TabGroup, error) {
	// Try to extract JSON from the response
	jsonStart := strings.Index(response, "[")
	jsonEnd := strings.LastIndex(response, "]")

	if jsonStart == -1 || jsonEnd == -1 || jsonEnd <= jsonStart {
		return nil, fmt.Errorf("could not find valid JSON in the response: %s", response)
	}

	jsonStr := response[jsonStart : jsonEnd+1]

	// Parse the JSON
	var groups []TabGroup
	err := json.Unmarshal([]byte(jsonStr), &groups)
	if err != nil {
		return nil, fmt.Errorf("error parsing JSON: %v, raw JSON: %s", err, jsonStr)
	}

	// Validate the groups
	for i, group := range groups {
		if group.GroupName == "" {
			return nil, fmt.Errorf("group %d has no name", i)
		}
		if len(group.TabIDs) == 0 {
			return nil, fmt.Errorf("group '%s' has no tabs", group.GroupName)
		}
	}

	return groups, nil
}

// mockOpenAIClient is a mock implementation of the OpenAI client for development/testing
type mockOpenAIClient struct{}

// GroupTabs returns mock tab groups for development/testing
func (c *mockOpenAIClient) GroupTabs(ctx context.Context, tabs []Tab) ([]TabGroup, int, error) {
	log.Println("Using mock OpenAI client")

	// Create a simple grouping based on domain
	groups := make(map[string][]int)

	for _, tab := range tabs {
		domain := extractDomain(tab.URL)
		groups[domain] = append(groups[domain], tab.ID)
	}

	// Convert to TabGroup slice
	var tabGroups []TabGroup
	for domain, tabIDs := range groups {
		tabGroups = append(tabGroups, TabGroup{
			GroupName: domain,
			TabIDs:    tabIDs,
		})
	}

	return tabGroups, 1, nil
}

// extractDomain extracts the domain from a URL
func extractDomain(url string) string {
	// Simple domain extraction
	if strings.Contains(url, "google") {
		return "Google"
	} else if strings.Contains(url, "github") {
		return "GitHub"
	} else if strings.Contains(url, "stackoverflow") {
		return "StackOverflow"
	} else if strings.Contains(url, "twitter") || strings.Contains(url, "x.com") {
		return "Twitter"
	} else if strings.Contains(url, "facebook") {
		return "Facebook"
	} else if strings.Contains(url, "youtube") {
		return "YouTube"
	} else {
		return "Other"
	}
}
