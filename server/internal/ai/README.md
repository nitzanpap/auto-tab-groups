# AI Tab Grouping Module

This module implements the AI-driven tab grouping feature for the Auto Tab Groups extension.

## Architecture

The AI tab grouping feature consists of:

1. **Backend (Go Server)**
   - REST API endpoint at `/api/group-tabs-ai`
   - Integration with OpenAI API
   - Token/quota management for users

2. **Frontend (Browser Extension)**
   - Integration with the existing Tab Group Service
   - UI for initiating AI-based grouping
   - Handling of API responses and error states

## Setup Requirements

### Server-side Requirements

- Go 1.19+
- OpenAI API key (set in `.env` file)
- Environment variables:

  ```
  OPENAI_API_KEY=your_openai_api_key_here
  ```

### Client-side Requirements

- Modern browser with tab grouping support (Chrome 89+, Edge 89+)
- Permissions for the extension to access tabs and tab groups

## Implementation Details

### AI Service (Go)

The AI service uses OpenAI's GPT models to analyze tab titles and URLs to suggest logical groupings. The process is:

1. Client sends tab metadata (id, title, url) to the server
2. Server formats this data into a prompt for the OpenAI API
3. The AI generates group suggestions in JSON format
4. Server processes the response and returns structured group data
5. Client applies these groupings to the actual browser tabs

### Token System

- Each AI grouping request consumes one token
- Free users get 10 tokens to try the feature
- Premium users (future implementation) will have unlimited tokens

### Error Handling

- Quota exceeded errors (HTTP 402)
- AI processing errors (HTTP 500)
- Invalid request format (HTTP 400)

## Future Enhancements

- Persistent storage for user quotas in database
- User authentication system
- Premium subscription management
- Improved AI prompts for better grouping accuracy
- Feedback mechanism to improve grouping quality over time
