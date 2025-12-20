# MyChatbot - Modern Chat Interface

## Overview
MyChatbot is a sleek, modern web-based chat application with an Apple-inspired glassmorphism design. It provides a clean, minimal interface with professional styling, generous spacing, and a refined color palette. The project aims to offer a seamless multi-user chat experience with robust authentication, message persistence, and AI integration. A key feature includes an analytics dashboard for comprehensive data visualization of ad campaigns across multiple platforms.

## User Preferences
- Clean, modern, classy interface
- Apple-inspired glassmorphism design
- Animated gradient background with floating orbs
- Light theme with professional color scheme
- Minimal distractions, focus on chat functionality
- Generous whitespace and breathing room

## System Architecture
The application is built with vanilla HTML, CSS, and JavaScript.

### UI/UX Decisions
- **Glassmorphism Design**: Apple-inspired semi-transparent panels with backdrop-blur effects (24px blur radius).
- **Animated Background**: Three floating gradient orbs with smooth 7-second blob animations.
- **Refined Color Palette**: 
  - Background gradient: gray-100 to gray-300 with animated blobs
  - Glass panels: rgba(255,255,255,0.3-0.6) with white/60-80 borders
  - Professional blue accent: #3b82f6 (#2563eb hover)
  - Text: gray-800 for primary, gray-500 for secondary
- **Collapsible Sidebar**: Smooth transition from 264px to 64px width with icon-only mode.
- **Generous Spacing**: Breathable layout with ample padding and whitespace.
- **Subtle Shadows**: Multi-layer glass shadows for depth (shadow-sm, shadow-md, shadow-lg).
- **Rounded Corners**: 8px for buttons, 12px for inputs, 16px for panels, 24px for containers.
- **Professional Typography**: Uses Inter font family.
- **Layout**: Collapsible left sidebar for navigation (logo, new chat, Chat/Dashboard/Documentation nav, recent chats, settings), and a main chat area with AI Assistant header, message list, and fixed input bar.
- **Message Display**: Glass bubble messages with avatars - user messages (right, 50% opacity), AI messages (left, 40% opacity).
- **Interactive Elements**: Typing indicator with lyrics, auto-scroll, profile dropdown, conversation history sidebar, chat deletion menu, sidebar collapse animation.
- **Dashboard Design**: Glass filter section, blue table headers (#3b82f6), collapsible content sections with smooth toggle animations.
- **Competitive Intelligence Suite**: 4-pillar tabbed navigation system:
  - **Battlefield Overview**: Share of Voice pie charts, market stats cards, competitor comparison grids
  - **Pulse of Engagement**: Activity timeline charts, Instagram trends, ad campaign format breakdowns
  - **Creative Strategy**: Visual post gallery (sorted by virality), Facebook ads gallery, Google ads gallery with image-first display
  - **Website Espionage**: Screenshot grid viewer with modal, text changes timeline tracking meta/title changes

### Technical Implementations
- **Authentication**: Supabase Auth with Google OAuth.
- **Database Architecture**: Two-database system:
    - Supabase PostgreSQL for user data, conversations, messages, and analytics data with Row Level Security (RLS) for multi-user isolation.
    - Central `companies` table with `company_key` (canonical identifier) for multi-company support.
    - All analytics tables (facebook_ads, google_ads, instagram_posts) reference companies via `company_id` foreign key.
    - n8n Redis for AI conversation context and memory, using UUID v4 session IDs.
- **Company-Based Filtering**: Canonical company identification system:
    - The `companies.company_key` field serves as the single source of truth for company identity.
    - The `companies.logo_url` field stores company logos displayed across the interface.
    - Backend n8n scraper uses `upsert_snapshot_bundle` RPC which maps `p_handle` (lowercased) to company_key and populates company_id across all analytics tables.
    - Frontend queries join analytics tables with companies via inner join and filter by `companies.company_key`.
    - Dashboard and chat interface both feature company selectors populated from the companies table.
    - AI requests include `companyKey` parameter to provide company-specific context.
- **Company Logo Display**: Unified logo rendering across the application:
    - Data tables show Company column with 20px rounded logos alongside company names.
    - Competitor cards display 36px logos in headers with rounded corners.
    - Ad galleries show 24px logos in brand sections.
    - Chat message tables detect company columns and render logos automatically.
    - Graceful fallback to blue gradient initials when logo_url is missing or fails to load.
    - Map-based lookup system in chat for efficient company-logo matching by both key and name.
- **AI Integration**: n8n webhook endpoint receives `sessionId`, `userId`, and `companyKey` for contextual AI responses.
- **Smart Rendering System**: Modular `message-renderer.js` supports various content types:
    - Text renderer with full Markdown support (Gemini-style formatting):
      - Headers (H1-H4) with proper sizing hierarchy and spacing
      - Bullet lists (- or *) and numbered lists (1. 2. 3.)
      - Horizontal rules (---) as visual separators
      - Blockquotes (>) with styled left border
      - Inline code (`code`) with monospace styling
      - Bold (**text**) and italic (*text*) formatting
      - URL auto-linking with XSS protection
      - Professional paragraph spacing and typography
    - Chart renderer using Chart.js 4.4.1 for bar, line, pie, and doughnut charts with white card design, title/subtitle header, clean data point markers, and multi-dataset support.
    - Table renderer with auto-column detection, white card design, light gray headers, automatic status indicators (colored dots for In Stock/Low Stock/Out of Stock), growth formatting (green positive/red negative), text truncation with expand/collapse for long content (>80 chars), image preview thumbnails for image URLs, and clickable links throughout.
    - Media gallery renderer with white card design, full-width images, centered captions, and elegant placeholder for broken images.
    - Supports JSON envelope responses for dynamic content.
    - Fully responsive design with optimized mobile/tablet layouts.
- **Event Handling**: Robust event listener management using named functions to prevent duplicates and ensure consistency.
- **Performance Optimizations**:
    - 300ms debouncing on dashboard and intelligence filter changes to reduce redundant database queries
    - 300ms debouncing on chat switching to prevent rapid click conflicts
    - Single conversation fetch during chat initialization (eliminated duplicate calls)
    - Local DOM manipulation for sidebar title updates with fallback reload
    - Non-blocking asynchronous timestamp updates
    - Parallelized post-response database operations with conversation ID guards to prevent race conditions
    - Production-clean codebase with debug logging removed (error logging retained)
- **Robust Message Saving**:
    - Messages capture conversation/user IDs at send time, ensuring saves complete to correct conversation even when switching chats
    - Background task tracking with `trackBackgroundTask()` for pending saves
    - Browser beforeunload warning when background work is in progress
    - Loading lock prevents duplicate conversation loads during async operations
    - Failed conversation loads allow immediate retry without navigating away
- **Enterprise Chat State Machine** (Added December 2025):
    - Finite state machine with IDLE/SENDING/AWAITING_AI/RENDERING/ERROR states
    - Automatic UI sync: input/button enabled states controlled by state machine, not manual calls
    - State-based guards prevent duplicate message sends while processing
    - Guaranteed IDLE state return in finally blocks prevents permanent freezes
    - Global safety watchdog: 60s timeout auto-resets stuck states
    - Typing effect timeout: 15s max with guaranteed promise resolution
    - AI request timeout: 45s with proper abort controller cleanup
    - Logger integration for all state transitions aids debugging
    - Exposed `ChatStateMachine` and `ChatState` on window for runtime debugging
- **Application Lifecycle Manager** (Added December 2025):
    - Strict initialization ordering: DOMContentLoaded → Auth.initialize() → Chat.initialize()
    - Promise-based `Auth.initialize()` ensures authentication completes before chat initialization
    - Global error boundary with `window.onerror` and `window.onunhandledrejection` handlers
    - Race condition prevention through sequential async/await initialization flow
    - Auth module exports both global functions and `Auth` object for backward compatibility
- **Standardized Database Layer** (Added December 2025):
    - All Supabase operations return standardized `{ success, data, error }` objects
    - Consistent error handling pattern: check `result.success` before accessing `result.data`
    - Failed operations include structured error information in `result.error`
    - All database operations use Logger for telemetry instead of raw console calls
- **Server**: Python HTTP server providing a `/api/config` endpoint for secure credential delivery (Supabase anon key).
- **Competitive Intelligence Suite**: `dashboard.html` with `intelligence.js` and `intelligence.css` for 4-pillar competitive analysis:
  - Data loading functions use `getCompanyIdsFromFilters()` helper for client-vs-competitor comparison
  - Supabase queries use `.in('company_id', companyIds)` to fetch data for both selected companies
  - Charts rendered with Chart.js 4.4.1 for Share of Voice, timeline trends, and format breakdowns
  - Visual galleries display images front-and-center, hiding technical columns (IDs, handles, vectorized_at)

### Feature Specifications
- **Multi-User Support**: Each user has private conversation history and data.
- **Multi-Company Support**: Centralized company management with canonical company_key identifier across all analytics data sources.
- **Session Management**: UUID session IDs per conversation for AI context.
- **Message Persistence**: Chat history saved in Supabase with RLS.
- **Typing Indicator**: Animated three-dot loading.
- **Auto-scroll**: Smart scrolling behavior, respecting user's scroll position while ensuring new messages are visible.
- **Conversation History**: Recent chats sidebar with automatic title generation.
- **Rich Content Display**: AI responses support rich text, interactive charts, tables, and media galleries.
- **Chat Deletion**: Option to delete conversations from history with confirmation.
- **Company Filtering**: Both dashboard and chat interface include company selectors for filtering data and providing context.
- **Competitive Intelligence Suite**: 4-pillar strategic dashboard with Battlefield Overview (market share), Pulse of Engagement (trends), Creative Strategy (visual galleries), and Website Espionage (screenshot tracking). Supports client-vs-competitor comparison with dual company filters.

## Logging Infrastructure
- **Enterprise Logger**: `logger.js` provides a centralized `Logger` class with static methods:
  - `Logger.info(message, context, meta)` - Blue-styled informational logs
  - `Logger.warn(message, context, meta)` - Orange-styled warning logs
  - `Logger.error(error, context, meta)` - Red-styled error logs with stack traces
- **Console Output**: Distinctive color-coded formatting for easy visual identification
- **Database Persistence**: Logs are persisted to `app_logs` Supabase table with user tracking
- **Fail-Safe Design**: Supabase persistence failures are silent; console logging always works
- **RLS Security**: Users can insert logs; only admins can read/delete logs

## External Dependencies
- **Supabase**: For user authentication (Google OAuth), PostgreSQL database (users, conversations, messages tables), and Row Level Security.
- **n8n**: Used as the AI backend, handling webhook endpoints for contextual AI responses and managing Redis for AI conversation memory.
- **Chart.js 4.4.1**: For rendering interactive charts within AI responses and the analytics dashboard.
- **Google Fonts (Google Sans, Roboto)**: For professional typography.