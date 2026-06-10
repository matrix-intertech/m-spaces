## Phase 3 Chat Consolidation Rollback Plan

### Rollback Scope
This phase focuses on audit, dependency mapping, and migration planning for chat consolidation. If any code changes are introduced later in the phase, rollback must preserve all existing conversation reads and writes.

### Files In Scope
- chat strategy documents
- any additive migration planning docs
- if touched later: `backend/chat-routes.js`, `backend/chat-ui-routes.js`, `backend/sockets.js`, `backend/bot-service.js`, chat policies, and chat-related migrations

### Rollback Strategy
- revert only Phase 3 chat-consolidation files
- preserve both legacy and new chat schemas until a fully validated migration exists
- do not delete or rewrite existing message data during audit/planning work

### Operational Safety
- keep both chat systems readable until canonical cutover is complete
- preserve property-chat room behavior and unread counts
- preserve support/admin review visibility
- keep bot automation working against the currently active property-chat model

### Validation After Rollback
- `node --check` on touched backend files
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`
- backend chat regression checks if route/service code changes were introduced

### Trigger Conditions For Rollback
- missing conversation history
- broken message send/read flows
- Socket.IO room mismatch
- unread counters no longer updating
- support/admin moderation visibility regression
