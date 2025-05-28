package server

import (
	"net/http"

	"log"

	"github.com/gin-gonic/gin"

	"server/internal/ai"
)

// GroupTabsAIHandler handles requests to group tabs using AI
func (s *Server) GroupTabsAIHandler(c *gin.Context) {
	var req ai.GroupTabsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ai.ErrorResponse{
			Error:       "Invalid request",
			Description: err.Error(),
		})
		return
	}

	// Log the request for debugging
	tabCount := len(req.Tabs)
	log.Printf("Received request to group %d tabs", tabCount)

	// Check if the user has sufficient quota
	remainingTokens, hasQuota := s.ai.CheckQuota(req.UserID)

	// Print remaining tokens for debugging
	log.Printf("User '%s' has %d tokens remaining", req.UserID, remainingTokens)
	if !hasQuota {
		c.JSON(http.StatusPaymentRequired, ai.ErrorResponse{
			Error:       "Quota exceeded",
			Description: "You have used all your available tokens. Please upgrade to premium.",
		})
		return
	}

	// Process the grouping request
	resp, err := s.ai.GroupTabs(c.Request.Context(), req)
	if err != nil {
		log.Printf("Error processing tab grouping request: %v", err)
		c.JSON(http.StatusInternalServerError, ai.ErrorResponse{
			Error:       "Processing error",
			Description: err.Error(),
		})
		return
	}

	// Log successful grouping
	log.Printf("Successfully grouped tabs into %d groups", len(resp.Groups))

	c.JSON(http.StatusOK, resp)
}
