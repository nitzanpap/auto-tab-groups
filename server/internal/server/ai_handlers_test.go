package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"server/internal/ai"
)

// mockAIService is a mock implementation of the AI service for testing
type mockAIService struct{}

func (m *mockAIService) GroupTabs(ctx context.Context, req ai.GroupTabsRequest) (ai.GroupTabsResponse, error) {
	// Return a mock response
	return ai.GroupTabsResponse{
		Groups: []ai.TabGroup{
			{
				GroupName: "Work",
				TabIDs:    []int{1, 3},
			},
			{
				GroupName: "Personal",
				TabIDs:    []int{2, 4},
			},
		},
		Usage: ai.UsageInfo{
			TokensUsed:      1,
			TokensRemaining: 9,
		},
	}, nil
}

func (m *mockAIService) CheckQuota(userID string) (int, bool) {
	// Mock quota check - everyone has quota except "no-quota-user"
	if userID == "no-quota-user" {
		return 0, false
	}
	return 10, true
}

func (m *mockAIService) UpdateQuota(userID string, tokensUsed int) (int, error) {
	// Mock quota update - just return 9 tokens remaining
	return 9, nil
}

func TestGroupTabsAIHandler(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	mockServer := &Server{
		ai: &mockAIService{},
	}

	// Test case 1: Valid request
	validReq := ai.GroupTabsRequest{
		Tabs: []ai.Tab{
			{ID: 1, Title: "Work Tab", URL: "https://example.com/work"},
			{ID: 2, Title: "Personal Tab", URL: "https://example.com/personal"},
			{ID: 3, Title: "Another Work Tab", URL: "https://example.com/work2"},
			{ID: 4, Title: "Another Personal Tab", URL: "https://example.com/personal2"},
		},
		UserID: "test-user",
	}

	reqBody, _ := json.Marshal(validReq)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/group-tabs-ai", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	mockServer.GroupTabsAIHandler(c)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var resp ai.GroupTabsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Error unmarshaling response: %v", err)
	}

	if len(resp.Groups) != 2 {
		t.Errorf("Expected 2 groups in response, got %d", len(resp.Groups))
	}

	// Test case 2: No quota
	noQuotaReq := ai.GroupTabsRequest{
		Tabs: []ai.Tab{
			{ID: 1, Title: "Work Tab", URL: "https://example.com/work"},
		},
		UserID: "no-quota-user",
	}

	reqBody, _ = json.Marshal(noQuotaReq)
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/group-tabs-ai", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	mockServer.GroupTabsAIHandler(c)

	if w.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status code %d, got %d", http.StatusPaymentRequired, w.Code)
	}

	// Test case 3: Invalid request (missing required field)
	invalidReq := struct {
		UserID string `json:"user_id"`
	}{
		UserID: "test-user",
	}

	reqBody, _ = json.Marshal(invalidReq)
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/group-tabs-ai", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	mockServer.GroupTabsAIHandler(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}
