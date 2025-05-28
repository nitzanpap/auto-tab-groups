package ai

// Tab represents a browser tab to be grouped
type Tab struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
}

// GroupTabsRequest is the incoming request structure for the AI grouping endpoint
type GroupTabsRequest struct {
	Tabs   []Tab  `json:"tabs" binding:"required"`
	UserID string `json:"user_id"`
	Token  string `json:"token"`
}

// TabGroup represents a group of tabs with a suggested name
type TabGroup struct {
	GroupName string `json:"group_name"`
	TabIDs    []int  `json:"tab_ids"`
}

// UsageInfo represents token usage information
type UsageInfo struct {
	TokensUsed      int `json:"tokens_used"`
	TokensRemaining int `json:"tokens_remaining"`
}

// GroupTabsResponse is the response structure for the AI grouping endpoint
type GroupTabsResponse struct {
	Groups []TabGroup `json:"groups"`
	Usage  UsageInfo  `json:"usage"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error       string `json:"error"`
	Description string `json:"description,omitempty"`
}
