# MyChatbot

A modern chat interface application with Google OAuth authentication and AI integration.

## Features
- Google OAuth Authentication
- Real-time chat interface
- Conversation history
- Multi-user support with Supabase
- AI-powered responses via n8n webhook

## Tech Stack
- Frontend: Vanilla HTML, CSS, JavaScript
- Backend: Python HTTP server
- Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth with Google OAuth
- AI Integration: n8n webhook

## Setup
1. Set up Supabase project with Google OAuth provider
2. Configure environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
3. Run `python server.py` to start the server on port 5000
4. Access via external URL (not iframe due to OAuth restrictions)

See `replit.md` for detailed documentation.
