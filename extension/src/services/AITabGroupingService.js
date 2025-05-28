/**
 * AI Tab Grouping Service
 * 
 * This service handles communication with the AI tab grouping API.
 */

// Base URL for the API server
const API_BASE_URL = 'http://localhost:8080';

/**
 * Checks if the AI service is available
 * @returns {Promise<boolean>} - True if service is available
 */
export async function isAIServiceAvailable() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Origin': browser.runtime.getURL('').replace(/\/$/, '')
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('AI service not available:', error);
    return false;
  }
}

/**
 * Groups tabs using AI
 * @param {Array} tabs - List of tab objects with id, title, and url
 * @param {string} userId - Optional user ID for quota tracking
 * @param {string} token - Optional auth token
 * @returns {Promise<Object>} - Promise resolving to the grouping response
 */
export async function groupTabsWithAI(tabs, userId = '', token = '') {
  try {
    // Format tabs for the API
    const tabsForApi = tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url
    }));

    // Create request payload
    const payload = {
      tabs: tabsForApi,
      user_id: userId,
      token: token
    };

    // Make API request
    const response = await fetch(`${API_BASE_URL}/api/group-tabs-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': browser.runtime.getURL('').replace(/\/$/, '') // Add origin header
      },
      body: JSON.stringify(payload)
    });

    // Check if the request was successful
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      
      // Handle quota exceeded error
      if (response.status === 402) {
        throw new Error('AI quota exceeded. Please upgrade to premium for unlimited AI grouping.');
      }
      
      throw new Error(`API error: ${errorData.error || `Status ${response.status}`}`);
    }

    // Parse and return the response
    return await response.json();
  } catch (error) {
    console.error('Error grouping tabs with AI:', error);
    
    // Add specific handling for CORS errors
    if (error.message.includes('NetworkError') || error.name === 'TypeError') {
      throw new Error('Cannot connect to AI service. Make sure the server is running and CORS is properly configured.');
    }
    
    throw error;
  }
}

/**
 * Checks if the user has remaining AI grouping tokens
 * @param {string} userId - User ID for quota tracking
 * @returns {Promise<boolean>} - Promise resolving to true if user has quota
 */
export async function checkAIQuota(userId = '') {
  try {
    // This is a simplified implementation
    // In a real app, you might want to have a dedicated endpoint for quota checking
    const dummyTab = { id: 0, title: 'Quota Check', url: 'https://example.com' };
    
    // Make a minimal request just to check quota
    const response = await fetch(`${API_BASE_URL}/api/group-tabs-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': browser.runtime.getURL('').replace(/\/$/, '') // Add origin header
      },
      body: JSON.stringify({
        tabs: [dummyTab],
        user_id: userId,
        token: ''
      })
    });
    
    // If we get a 402 Payment Required, the user has no quota
    return response.status !== 402;
  } catch (error) {
    console.error('Error checking AI quota:', error);
    // Display more specific error messages
    if (error.message.includes('NetworkError') || error.name === 'TypeError') {
      console.warn('Cannot connect to AI service. Make sure the server is running.');
    }
    // Default to false on error to prevent unexpected behavior
    return false;
  }
}
