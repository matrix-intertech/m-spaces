## Phase 3 Chat Consolidation Dependency Map

### Objective
Consolidate MatrixSpaces onto one canonical chat architecture while preserving all existing conversations, property chat workflows, Socket.IO behavior, dashboards, notifications, and permissions.

### Current Chat Data Models
- Legacy:
  - `messages`
  - `conversations`
- Newer property chat model:
  - `property_conversations`
  - `chat_messages`

### Primary Runtime Owners
- `backend/chat-routes.js`
- `backend/chat-ui-routes.js`
- `backend/sockets.js`
- `backend/property-routes.js`
- `backend/dashboard-routes.js`
- `backend/admin-routes.js`
- `backend/bot-service.js`
- `backend/property-access.js`
- `backend/policies/conversation-policy.js`

### Frontend Chat Consumers
- `frontend/app/messages/page.tsx`
- `frontend/app/messages/[conversationId]/page.tsx`
- `frontend/components/chat/*`
- `frontend/hooks/useSocket.ts`
- `frontend/services/api.ts`

### Closely Coupled Supporting Systems
- notifications
- Saksh bot automation
- unread counters
- property ownership / management access checks
- buyer / tenant identity mapping
- dashboard role panels
- admin moderation / support review flows

### Key Consolidation Risks
- duplicate message history across legacy and newer schemas
- route behavior differences between legacy UI and new API consumers
- Socket.IO room naming depends on property-centric chat behavior
- bot automation is already coupled to `property_conversations` + `chat_messages`
- support/admin moderation paths may still assume mixed conversation sources

### Phase 3 Verification Targets
- every chat read/write path inventoried
- one canonical model selected with evidence
- no data-loss migration strategy documented
- Socket.IO compatibility path documented
- backward-compatible rollout path defined before any destructive migration
