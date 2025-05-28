package ai

import (
	"context"
	"testing"
)

// mockOpenAIClientForTest is a mock implementation of OpenAIClient for testing
type mockOpenAIClientForTest struct {
	shouldFail bool
}

func (m *mockOpenAIClientForTest) GroupTabs(ctx context.Context, tabs []Tab) ([]TabGroup, int, error) {
	if m.shouldFail {
		return nil, 0, &testError{"mock error"}
	}

	return []TabGroup{
		{
			GroupName: "Group 1",
			TabIDs:    []int{1, 2},
		},
		{
			GroupName: "Group 2",
			TabIDs:    []int{3, 4},
		},
	}, 1, nil
}

// testError is a simple error implementation for testing
type testError struct {
	message string
}

func (e *testError) Error() string {
	return e.message
}

func TestServiceGroupTabs(t *testing.T) {
	// Create a service with a mock OpenAI client
	mockClient := &mockOpenAIClientForTest{shouldFail: false}
	svc := &service{
		openAI:        mockClient,
		quotas:        map[string]int{"test-user": 10},
		defaultTokens: 10,
	}

	// Test successful grouping
	req := GroupTabsRequest{
		Tabs: []Tab{
			{ID: 1, Title: "Tab 1", URL: "https://example.com/1"},
			{ID: 2, Title: "Tab 2", URL: "https://example.com/2"},
			{ID: 3, Title: "Tab 3", URL: "https://example.com/3"},
			{ID: 4, Title: "Tab 4", URL: "https://example.com/4"},
		},
		UserID: "test-user",
	}

	resp, err := svc.GroupTabs(context.Background(), req)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if len(resp.Groups) != 2 {
		t.Errorf("Expected 2 groups, got %d", len(resp.Groups))
	}

	if resp.Usage.TokensUsed != 1 {
		t.Errorf("Expected 1 token used, got %d", resp.Usage.TokensUsed)
	}

	if resp.Usage.TokensRemaining != 9 {
		t.Errorf("Expected 9 tokens remaining, got %d", resp.Usage.TokensRemaining)
	}

	// Test failure due to OpenAI error
	mockClient.shouldFail = true
	_, err = svc.GroupTabs(context.Background(), req)
	if err == nil {
		t.Error("Expected error, got nil")
	}

	// Test failure due to insufficient quota
	svc.quotas["test-user"] = 0
	_, err = svc.GroupTabs(context.Background(), req)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}

func TestServiceCheckQuota(t *testing.T) {
	svc := &service{
		quotas:        map[string]int{"existing-user": 5},
		defaultTokens: 10,
	}

	// Test existing user
	tokens, hasQuota := svc.CheckQuota("existing-user")
	if tokens != 5 {
		t.Errorf("Expected 5 tokens, got %d", tokens)
	}
	if !hasQuota {
		t.Error("Expected hasQuota to be true")
	}

	// Test new user (should be initialized with default tokens)
	tokens, hasQuota = svc.CheckQuota("new-user")
	if tokens != 10 {
		t.Errorf("Expected 10 tokens, got %d", tokens)
	}
	if !hasQuota {
		t.Error("Expected hasQuota to be true")
	}

	// Test user with no quota
	svc.quotas["no-quota-user"] = 0
	tokens, hasQuota = svc.CheckQuota("no-quota-user")
	if tokens != 0 {
		t.Errorf("Expected 0 tokens, got %d", tokens)
	}
	if hasQuota {
		t.Error("Expected hasQuota to be false")
	}
}

func TestServiceUpdateQuota(t *testing.T) {
	svc := &service{
		quotas:        map[string]int{"existing-user": 5},
		defaultTokens: 10,
	}

	// Test existing user
	remaining, err := svc.UpdateQuota("existing-user", 2)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if remaining != 3 {
		t.Errorf("Expected 3 tokens remaining, got %d", remaining)
	}

	// Test new user (should be initialized with default tokens)
	remaining, err = svc.UpdateQuota("new-user", 3)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if remaining != 7 {
		t.Errorf("Expected 7 tokens remaining, got %d", remaining)
	}

	// Test insufficient tokens
	_, err = svc.UpdateQuota("existing-user", 10)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}
