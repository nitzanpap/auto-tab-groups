package ai

import (
	"context"
	"os"
	"strings"
	"testing"
)

func TestBuildTabGroupingPrompt(t *testing.T) {
	tabs := []Tab{
		{ID: 1, Title: "GitHub - My Repository", URL: "https://github.com/username/repo"},
		{ID: 2, Title: "Stack Overflow - Question", URL: "https://stackoverflow.com/questions/12345"},
		{ID: 3, Title: "Google", URL: "https://google.com"},
	}

	prompt := buildTabGroupingPrompt(tabs)

	// Check that the prompt contains the tab information
	for _, tab := range tabs {
		if prompt == "" {
			t.Errorf("Expected prompt to be non-empty")
		}
		if !contains(prompt, tab.Title) {
			t.Errorf("Expected prompt to contain tab title %s", tab.Title)
		}
		if !contains(prompt, tab.URL) {
			t.Errorf("Expected prompt to contain tab URL %s", tab.URL)
		}
	}
}

func TestParseOpenAIResponse(t *testing.T) {
	// Valid JSON response
	validResponse := `Here are the grouped tabs:
[
  {
    "group_name": "Development",
    "tab_ids": [1]
  },
  {
    "group_name": "Q&A",
    "tab_ids": [2]
  },
  {
    "group_name": "Search",
    "tab_ids": [3]
  }
]`

	groups, err := parseOpenAIResponse(validResponse)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if len(groups) != 3 {
		t.Errorf("Expected 3 groups, got %d", len(groups))
	}

	// Invalid JSON response
	invalidResponse := "This is not a valid JSON response"
	_, err = parseOpenAIResponse(invalidResponse)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}

func TestMockOpenAIClient(t *testing.T) {
	client := &mockOpenAIClient{}
	tabs := []Tab{
		{ID: 1, Title: "GitHub - My Repository", URL: "https://github.com/username/repo"},
		{ID: 2, Title: "Stack Overflow - Question", URL: "https://stackoverflow.com/questions/12345"},
	}

	groups, tokensUsed, err := client.GroupTabs(context.Background(), tabs)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if tokensUsed != 1 {
		t.Errorf("Expected 1 token used, got %d", tokensUsed)
	}
	if len(groups) == 0 {
		t.Error("Expected groups to be non-empty")
	}
}

// Skip this test if OPENAI_API_KEY is not set
func TestOpenAIClient(t *testing.T) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" || apiKey == "your_openai_api_key_here" || apiKey == "sk-****" {
		t.Skip("OPENAI_API_KEY not set, skipping test")
	}

	client := NewOpenAIClient(apiKey)
	tabs := []Tab{
		{ID: 1, Title: "GitHub - My Repository", URL: "https://github.com/username/repo"},
		{ID: 2, Title: "Stack Overflow - Question", URL: "https://stackoverflow.com/questions/12345"},
		{ID: 3, Title: "Google", URL: "https://google.com"},
	}

	groups, tokensUsed, err := client.GroupTabs(context.Background(), tabs)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if tokensUsed < 1 {
		t.Errorf("Expected at least 1 token used, got %d", tokensUsed)
	}
	if len(groups) == 0 {
		t.Error("Expected groups to be non-empty")
	}
}

// Helper function to check if a string contains another string
func contains(s, substr string) bool {
	return s != "" && substr != "" && len(s) >= len(substr) && s != substr && strings.Contains(s, substr)
}
