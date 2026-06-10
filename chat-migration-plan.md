# MatrixSpaces Chat Migration Plan

Branch: `hardening-phase-3-chat-consolidation`

## Executive Decision

The canonical chat architecture should be:

- `property_conversations`
- `chat_messages`

This is already the active runtime model for:

- chat API routes
- Socket.IO delivery
- unread counters
- bot automation
- Next.js messaging workspace
- property-chat start flow

The legacy model:

- `messages`
- `conversations`

should be treated as compatibility residue that must be migrated and eventually retired.

## Evidence

### Active runtime path

- [chat-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/chat-routes.js)
  - lists conversations from `property_conversations`
  - reads messages from `chat_messages`
  - creates conversations in `property_conversations`
  - writes messages to `chat_messages`
  - manages unread counts in `property_conversations`
  - toggles bot state on `property_conversations`

- [sockets.js](/c:/Users/Shikhar/Matrixspaces/backend/sockets.js)
  - creates or updates `property_conversations`
  - writes new messages to `chat_messages`
  - emits realtime updates keyed by conversation id
  - uses the property-chat room structure and bot automation around the new model

- [chat-ui-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/chat-ui-routes.js)
  - inbox, property conversation lists, and conversation views all read from `property_conversations`
  - conversation windows load `chat_messages`

- [MessagingWorkspace.tsx](/c:/Users/Shikhar/Matrixspaces/frontend/components/chat/MessagingWorkspace.tsx)
  - fetches `/chat/conversations`
  - fetches `/chat/conversations/:id/messages`
  - marks conversations read
  - sends messages via Socket.IO conversation flow

### Legacy-only residual usage

- [property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js)
  - property detail still reads historical `messages` by `property_id` and `tenant_username`
  - property deletion still deletes from `messages`

- [admin-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/admin-routes.js)
  - admin dashboards read modern `property_conversations`
  - but destructive user/property cleanup still deletes from legacy `messages`

- [db-init.js](/c:/Users/Shikhar/Matrixspaces/backend/db-init.js)
  - still defines both chat models
  - still contains backfill logic from `messages` into `conversations`

## Current Chat Dependency Map

### Canonical-path dependencies

- `backend/chat-routes.js`
- `backend/chat-ui-routes.js`
- `backend/sockets.js`
- `backend/bot-service.js`
- `backend/property-access.js`
- `backend/policies/conversation-policy.js`
- `frontend/components/chat/MessagingWorkspace.tsx`
- `frontend/components/chat/StartChatButton.tsx`
- `frontend/services/api.ts`
- `frontend/hooks/useSocket.ts`

### Legacy-path dependencies

- `backend/property-routes.js`
- `backend/admin-routes.js`
- historical cleanup flows
- any old EJS rendering still expecting `messages`

## Canonical Model Rationale

`property_conversations` + `chat_messages` is the right target because it supports:

- user-id based authorization instead of username matching
- buyer/management separation
- unread counts per side
- soft deletion per user
- bot enable/disable state
- Socket.IO conversation rooms
- richer authorization policy integration

The legacy `messages` model is structurally weaker because it relies on:

- `sender_username`
- `tenant_username`
- property-scoped message grouping
- weaker participant identity guarantees

## Migration Strategy

### Phase A: Freeze new feature work on legacy model

- No new writes should be added to `messages` or `conversations`
- Any new chat feature must target `property_conversations` and `chat_messages`

### Phase B: Inventory legacy data

- count all rows in `messages`
- count all rows in `conversations`
- identify rows already backfilled to `conversations`
- identify any legacy messages that do not map cleanly to a buyer user id
- identify property messages tied to deleted or renamed usernames

### Phase C: Build additive migration

- create a migration that:
  - maps legacy `tenant_username` to `users.id`
  - creates missing `property_conversations`
  - copies legacy `messages` into `chat_messages`
  - preserves `created_at`
  - preserves read/deleted state where available
  - records a legacy source marker for auditability if needed

### Phase D: Compatibility reads

- change remaining legacy readers in:
  - `property-routes.js`
  - admin cleanup / review flows
- these should read from the canonical model or a compatibility adapter

### Phase E: Cleanup phase

- only after verification:
  - remove legacy `messages` reads
  - remove legacy `conversations` reads
  - stop deleting from legacy tables in destructive flows
  - deprecate old schema objects in a later migration

## No-Data-Loss Requirements

- preserve every existing message body
- preserve sender identity
- preserve property linkage
- preserve timestamp ordering
- preserve unread semantics where reconstructable
- preserve support/admin moderation access
- preserve bot messages and bot visibility flags

## Realtime Compatibility Requirements

- keep `conv_<id>` room behavior unchanged
- keep property-specific fallback room behavior during transition
- preserve `receive_message`, `typing`, `stop_typing`, and `message_read` events

## High-Risk Areas

1. legacy property page message history in [property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js)
2. mixed cleanup logic in [admin-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/admin-routes.js)
3. username-to-user-id mapping for old rows
4. bot automation already assuming canonical property conversations
5. duplicate schema definitions still living in [db-init.js](/c:/Users/Shikhar/Matrixspaces/backend/db-init.js)

## Recommended Next Implementation Slice

1. Add a migration inventory for legacy chat rows
2. Build a one-time backfill migration from `messages` to `chat_messages`
3. Replace property-detail legacy message reads with canonical conversation reads
4. Replace admin destructive deletes against `messages` with canonical cleanup handling
