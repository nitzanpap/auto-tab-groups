package ai

import (
	"context"
	"os"
	"testing"
)

func TestQuotaManagement(t *testing.T) {
	// Skip if we don't have an API key for real tests
	if os.Getenv("OPENAI_API_KEY") == "" {
		t.Skip("Skipping test: OPENAI_API_KEY environment variable not set")
	}

	service := New()

	// Test case 1: Anonymous user should get default quota
	tokens, hasQuota := service.CheckQuota("")
	if !hasQuota {
		t.Error("Expected anonymous user to have quota")
	}
	if tokens != DefaultFreeQuota {
		t.Errorf("Expected %d tokens, got %d", DefaultFreeQuota, tokens)
	}

	// Test case 2: New user should get default quota
	tokens, hasQuota = service.CheckQuota("new-user-123")
	if !hasQuota {
		t.Error("Expected new user to have quota")
	}
	if tokens != DefaultFreeQuota {
		t.Errorf("Expected %d tokens, got %d", DefaultFreeQuota, tokens)
	}

	// Test case 3: Update quota and check remaining
	remaining, err := service.UpdateQuota("new-user-123", 1)
	if err != nil {
		t.Errorf("Error updating quota: %v", err)
	}
	if remaining != DefaultFreeQuota-1 {
		t.Errorf("Expected %d tokens remaining, got %d", DefaultFreeQuota-1, remaining)
	}

	// Test case 4: Check updated quota
	tokens, hasQuota = service.CheckQuota("new-user-123")
	if !hasQuota {
		t.Error("Expected user to still have quota")
	}
	if tokens != DefaultFreeQuota-1 {
		t.Errorf("Expected %d tokens, got %d", DefaultFreeQuota-1, tokens)
	}

	// Test case 5: Use all remaining quota
	remaining, err = service.UpdateQuota("new-user-123", DefaultFreeQuota-1)
	if err != nil {
		t.Errorf("Error updating quota: %v", err)
	}
	if remaining != 0 {
		t.Errorf("Expected 0 tokens remaining, got %d", remaining)
	}

	// Test case 6: Check empty quota
	tokens, hasQuota = service.CheckQuota("new-user-123")
	if hasQuota {
		t.Error("Expected user to have no quota left")
	}
	if tokens != 0 {
		t.Errorf("Expected 0 tokens, got %d", tokens)
	}
}

func TestMockGroupTabs(t *testing.T) {
	// Create a sample request
	req := GroupTabsRequest{
		Tabs: []Tab{
			{ID: 1, Title: "GitHub - Home", URL: "https://github.com"},
			{ID: 2, Title: "Gmail - Inbox", URL: "https://mail.google.com"},
			{ID: 3, Title: "React Documentation", URL: "https://reactjs.org/docs"},
			{ID: 4, Title: "Node.js", URL: "https://nodejs.org"},
		},
		UserID: "test-user",
	}

	// Skip actual API calls in automated tests
	if os.Getenv("OPENAI_API_KEY") == "" {
		t.Skip("Skipping test: OPENAI_API_KEY environment variable not set")
	}

	service := New()
	resp, err := service.GroupTabs(context.Background(), req)
	if err != nil {
		t.Fatalf("Error calling GroupTabs: %v", err)
	}

	// Basic validation of the response
	if len(resp.Groups) == 0 {
		t.Error("Expected at least one group in the response")
	}

	// Check that all tabs are assigned to groups
	assignedTabs := make(map[int]bool)
	for _, group := range resp.Groups {
		for _, tabID := range group.TabIDs {
			assignedTabs[tabID] = true
		}
	}
	if len(assignedTabs) != len(req.Tabs) {
		t.Errorf("Not all tabs were assigned to groups. Expected %d, got %d", len(req.Tabs), len(assignedTabs))
	}

	// Check usage information
	if resp.Usage.TokensUsed != 1 {
		t.Errorf("Expected 1 token used, got %d", resp.Usage.TokensUsed)
	}
}
