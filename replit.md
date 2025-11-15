# MyChatbot - Modern Chat Interface

## Overview
A sleek, modern web-based chat application inspired by Google Gemini's design principles. Built with vanilla HTML, CSS, and JavaScript, featuring a clean minimal interface with professional styling, generous spacing, and a refined color palette.

## Project Structure
```
.
├── index.html          # Main chat interface
├── login.html          # Google OAuth login page
├── style.css           # Modern styling with refined color palette
├── script.js           # Chat application logic
├── auth.js             # Supabase authentication handling
├── database.js         # Supabase database operations
├── config.js           # Configuration management
├── utils.js            # Utility functions (toast, loading, error handling)
├── server.py           # Python HTTP server with /api/config endpoint
├── supabase_schema.sql # Database schema for multi-user support
└── attached_assets/    # Reference screenshots
```

## Design Features
- **Clean Minimal Interface**: Removed welcome screen for a streamlined chat experience
- **Refined Color Palette**: 
  - Background: #f0f4f9 (soft off-white/light gray)
  - Text: #1f1f1f (professional dark gray)
  - Borders: #e0e0e0 (subtle light gray)
  - Accent: #1a73e8 (professional blue)
- **Generous Spacing**: Breathable layout with ample padding and whitespace
- **Subtle Shadows**: Modern layered feel with box shadows on key elements
- **Rounded Corners**: Soft, modern aesthetic throughout
- **Professional Typography**: Google Sans and Roboto fonts

## Layout Structure
### Left Sidebar
- **MyChatbot** logo and menu button
- **New chat** button with subtle border
- **Recent** chat history section
- **Settings & help** footer item

### Main Chat Area
- Simple header with profile icon (top right)
- Empty message-list container (ready for chat bubbles)
- Fixed input bar at bottom with:
  - Attach button
  - Text input field
  - Voice input button
  - Elevated shadow effect on focus

## Features
- **Google OAuth Authentication**: Seamless sign-in with Google via Supabase
- **Multi-User Support**: Each user has their own conversation history and data
- **Session Management**: UUID session IDs per conversation for AI context
- **Message Persistence**: Chat history saved in Supabase database with RLS policies
- **Typing Indicator**: Animated three-dot loading animation for AI responses
- **Auto-scroll**: Automatically scrolls to bottom on new messages
- **User Messages**: Blue bubbles on the right with white text
- **AI Messages**: Clean text on the left with generous line spacing
- **Conversation History**: Recent chats sidebar with automatic title generation
- **Profile Dropdown**: User info display with logout functionality

## Technical Implementation
- **Authentication**: Supabase Auth with Google OAuth provider
- **Database**: Two-database architecture:
  - Supabase PostgreSQL for user data and conversation metadata (users, conversations, messages tables)
  - n8n Redis for AI conversation context and memory
- **Session ID**: UUID v4 format per conversation, sent to n8n for context tracking
- **Message Storage**: PostgreSQL with Row Level Security policies for multi-user isolation
- **AI Integration**: n8n webhook endpoint receives sessionId and userId for contextual responses
- **Event Handling**: Robust event listener management with named functions and duplicate prevention
- **Server**: Python HTTP server with /api/config endpoint for secure credential delivery
- **Security**: Supabase anon key delivered via server endpoint, RLS policies enforce data isolation

## User Preferences
- Clean, modern, classy interface
- Light theme with professional color scheme
- Minimal distractions, focus on chat functionality
- Generous whitespace and breathing room

## Recent Changes
- 2025-11-08: Initial project creation
  - Created complete HTML structure with sidebar and main chat area
  - Implemented CSS styling matching Google Gemini design
  - Added JavaScript for session management and chat functionality
  - Set up workflow to serve on port 5000

- 2025-11-08: UI Refinement
  - Removed welcome screen (Hello, Harutyun, suggestion buttons, tools)
  - Changed branding from "Gemini" to "MyChatbot"
  - Removed "Explore Gems" button from sidebar
  - Replaced complex header with simple profile icon
  - Updated color scheme to #f0f4f9 background with #1f1f1f text
  - Added subtle box shadows and refined borders (#e0e0e0)
  - Increased spacing and padding throughout
  - Updated user message bubbles to blue with white text
  - Enhanced input area with elevated shadow effect

- 2025-11-08: Backend Integration
  - Connected chat to AI backend API (n8n webhook)
  - Replaced simulated responses with real API calls
  - API endpoint: https://wimedia.app.n8n.cloud/webhook/chat
  - Sends sessionId and message in POST request
  - Receives AI response in JSON format
  - Added error handling with gentle error messages
  - Maintains typing indicator during API calls

- 2025-11-08: Multi-User Authentication & Database
  - Implemented Google OAuth authentication via Supabase
  - Created Supabase database schema with users, conversations, and messages tables
  - Added Row Level Security policies for multi-user data isolation
  - Migrated from localStorage to PostgreSQL database
  - Integrated n8n webhook with userId and sessionId parameters
  - Built comprehensive error handling and toast notifications
  - Created server-side /api/config endpoint for secure credential delivery
  - Added profile dropdown with user info display
  - Implemented New Chat and Logout functionality
  - Added server stability improvements (SO_REUSEADDR for clean restarts)

- 2025-11-10: Event Listener Reliability Fix
  - Fixed intermittent button behavior caused by duplicate event listeners
  - Added initialization guard flag (isInitialized) to prevent multiple initializeChat() calls
  - Refactored all event handlers to use named functions instead of anonymous functions
  - Implemented removeEventListener before addEventListener for all buttons (send, new chat, logout, enter key)
  - Added console logging for event listener attachment debugging
  - Ensured buttons respond consistently regardless of page state changes
  - Fixed race condition: chat initialization now waits for authentication to complete
  - Added detailed logging for data loading stages to help debug issues

- 2025-11-10: AI Response Formatting Enhancement
  - Implemented rich text formatting for AI responses (Google Gemini style)
  - URLs automatically converted to clickable links that open in new tabs
  - Added support for basic markdown (bold with **, italic with *)
  - Proper paragraph spacing and line break handling for better readability
  - XSS protection through HTML escaping before formatting
  - Links styled with professional blue color and subtle hover effects
  - Improved word wrapping for long URLs

## Usage
The application runs on port 5000 using Python's built-in HTTP server. 

**Important**: Due to Google OAuth iframe restrictions in Replit preview, users must access the application via the external URL in a separate browser tab, not through the Replit preview window.

Users can:
1. Sign in with their Google account via OAuth
2. Type messages in the input field at the bottom
3. Press Enter or click send button to send messages
4. View typing indicator while AI processes the request
5. See their conversation history in the sidebar
6. Click on previous conversations to reload them
7. Click "New chat" to start a fresh conversation
8. View their profile and sign out via the profile dropdown (top right)

**Note**: Each user's conversations are private and isolated via database Row Level Security policies. The AI maintains conversation context using session IDs stored in Redis (managed by n8n).
