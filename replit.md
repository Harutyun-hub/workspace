# MyChatbot - Modern Chat Interface

## Overview
MyChatbot is a sleek, modern web-based chat application featuring an Apple-inspired glassmorphism design. It aims to provide a seamless multi-user chat experience with robust authentication, message persistence, and AI integration. A key feature is an analytics dashboard for comprehensive data visualization of ad campaigns across multiple platforms, alongside a "War Room" for tactical competitive intelligence.

## User Preferences
- Clean, modern, classy interface
- Apple-inspired glassmorphism design
- Animated gradient background with floating orbs
- Light theme with professional color scheme
- Minimal distractions, focus on chat functionality
- Generous whitespace and breathing room

## System Architecture
The application is built with vanilla HTML, CSS, and JavaScript, emphasizing a glassmorphism aesthetic and robust data handling.

### UI/UX Decisions
- **Glassmorphism Design**: Apple-inspired semi-transparent panels with a 24px backdrop-blur.
- **Animated Background**: Three floating gradient orbs with smooth 7-second blob animations.
- **Refined Color Palette**: Light theme with professional blue accents (`#3b82f6`) and gray tones.
- **Layout**: Collapsible left sidebar for navigation, main chat area with AI Assistant header, message list, and fixed input bar.
- **Message Display**: Glass bubble messages with avatars; user messages on the right (50% opacity), AI messages on the left (40% opacity).
- **Dashboard Design**: Glass filter section, blue table headers, collapsible content sections.
- **Competitive Intelligence Suite**: 4-pillar tabbed navigation for Battlefield Overview, Pulse of Engagement, Creative Strategy, and Website Espionage.
- **War Room Design**: "Neon Glass" dark cyberpunk aesthetic with deep slate background, neon accents, Inter and JetBrains Mono typography, DEFCON module, Aggression Gauge, Ticker Tape, Mission Control dropdowns with neon glow effects, and bi-directional Battlefield timeline chart.

### Technical Implementations
- **Authentication**: Supabase Auth with Google OAuth.
- **Database Architecture**: Two-database system utilizing Supabase PostgreSQL for user data, conversations, messages, and analytics (with RLS), and n8n Redis for AI conversation context and memory. Features a central `companies` table for multi-company support.
- **Company-Based Filtering**: Canonical `company_key` for identifying companies across all data, with logo display and company selectors in UI.
- **AI Integration**: n8n webhook endpoint for contextual AI responses based on `sessionId`, `userId`, and `companyKey`.
- **Smart Rendering System**: Modular `message-renderer.js` supporting rich text (Markdown), Chart.js charts, data tables with auto-column detection and status indicators, and media galleries.
- **Performance Optimizations**: SupabaseManager singleton, QueryCache for memory/localStorage caching, batched logging, server-side config injection, and debouncing for UI interactions.
- **Robust Message Saving**: Messages capture conversation/user IDs at send time, background task tracking, and browser `beforeunload` warning.
- **Enterprise Chat State Machine**: Manages chat states (IDLE, SENDING, AWAITING_AI, RENDERING, ERROR) for UI sync, prevents duplicate sends, and includes global safety watchdog timeouts.
- **Application Lifecycle Manager**: Ensures strict initialization order (DOM, Auth, Chat) with promise-based execution and global error boundaries.
- **Standardized Database Layer**: All Supabase operations return `{ success, data, error }` objects for consistent error handling.
- **Server**: Python HTTP server for `/api/config` to deliver secure credentials.
- **Competitive Intelligence Suite**: `dashboard.html` with client-vs-competitor comparison using Supabase queries and Chart.js.
- **War Room**: `/war_room.html` standalone page with Command Deck (DEFCON + Aggression Gauge from `intelligence_scores` view), Mission Control (company selector dropdowns with neon glow), and "Stacked Frontline" Battlefield Chart. The chart uses a 70/30 layout with 4 stacked datasets: US Paid Ads (neon blue #3B82F6), US Organic (faded blue 30%), THEM Paid Ads (neon red #EF4444), THEM Organic (faded red 30%). Features custom HTML legend showing "PAID OFFENSIVE" and "ORGANIC NOISE" indicators for both sides. Y-axis displays no tick numbers with white frontline at y=0. Intel Feed panel (30% width) shows actual enemy creatives (thumbnails, source icons, truncated text, dates) on chart hover with default most recent 3 enemy paid items. All sections auto-refresh every 30 seconds. TotoGaming Protocol ensures default selection of company ID `9b67e411-ec00-47d9-87d4-a56dacf41e8a` as the friendly DEFENSE ASSET.

### Feature Specifications
- **Multi-User/Multi-Company Support**: Private conversation history and data with centralized company management.
- **Session Management**: UUID session IDs for AI context.
- **Message Persistence**: Chat history saved in Supabase with RLS.
- **Rich Content Display**: AI responses support rich text, interactive charts, tables, and media galleries.
- **Competitive Intelligence Suite**: 4-pillar strategic dashboard for market analysis, engagement trends, creative strategy, and website tracking.
- **War Room**: Tactical Command Center displaying DEFCON threat levels, aggression gauge, live competitor activity ticker, Mission Control for company vs. competitor selection (TotoGaming Protocol default), and "Stacked Frontline" Battlefield chart showing 30-day marketing activity timeline with 4 datasets (Paid vs Organic for both sides) and Live Intel Feed sidebar displaying actual competitor creatives on hover.

## External Dependencies
- **Supabase**: User authentication (Google OAuth), PostgreSQL database, and Row Level Security.
- **n8n**: AI backend for contextual responses and Redis for AI conversation memory.
- **Chart.js 4.4.1**: Interactive charts for AI responses and the analytics dashboard.
- **Google Fonts**: Inter, JetBrains Mono for typography.