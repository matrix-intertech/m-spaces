# MatrixSpaces Route Inventory Snapshot

Date: 2026-06-05
Branch: `production-hardening`

## Snapshot Purpose

This inventory captures the route surface before the next hardening phase.
Preserving these endpoints is a compatibility requirement.

## Backend Route Families

### `backend/server.js`
- Core middleware, security headers, CORS, sessions, Auth0, Next renderer.
- Direct routes include static icons, logout API, compare toggle, user review, static informational pages, places search/nearby, avatar upload.
- Mounts:
  - `/` -> `auth-routes`
  - `/` -> `public-routes`
  - `/` -> `dashboard-routes`
  - `/` -> `referral-routes`
  - `/builder` -> `builder-routes`
  - `/admin` -> `admin-routes`
  - `/owner` -> `owner-routes`
  - `/property` -> `property-routes`
  - `/chat` -> `chat-routes`
  - `/messages` -> `chat-ui-routes`

### Auth Routes
- OTP and WhatsApp OTP send/verify/login.
- Auth0 login/sync/role completion.
- Signup, builder signup, corporate signup.
- Login, 2FA login, logout.
- Email verification, forgot/reset password.

### Public Routes
- Home, search, requirements board, properties APIs, user API, favorites, compare, partners, portfolio, local brokers.

### Dashboard Routes
- Recommended/favorites/recently viewed.
- Conversations and notifications.
- Visits and visit management.
- Profile, wallet, vault.
- List property.
- Broker dashboard/actions.
- Sales dashboard/actions.
- Corporate dashboard/actions.
- Owner assignment shortcut.
- Contact/report.

### Admin Routes
- Admin dashboard.
- Property verification/status.
- User/team management.
- Permissions.
- Visits.
- Corporate approvals/requirements.
- Leads.
- Referrals/withdrawals.
- Bot responses.
- Exports.
- KYC file serving.

### Builder Routes
- Builder dashboard.
- Agent management.
- Visits.
- Tasks.
- Transactions.
- Projects.
- Broker assignment.
- Inventory.
- Leads.
- Portfolio.
- KYC upload.

### Owner Routes
- Owner dashboard.
- Broker rating.
- Broker assignment/removal.
- Property edit.
- Ownership declaration.

### Property Routes
- Property detail.
- Contact request.
- Review.
- Add property.
- Delete property.

### Chat Routes
- Conversation list.
- Messages.
- Start conversation.
- Send message.
- Mark read.
- Delete conversation.
- Toggle bot.

## Mutation Families To Harden First

- Auth form submits and verification routes
- Property mutations
- Owner dashboard mutations
- Broker and sales dashboard mutations
- Builder mutations
- Admin mutations
- Chat mutations
- Referral and wallet mutations

## Inventory Note

The route inventory is intentionally summarized. Full line-level route inventory was generated with `Select-String` before remediation work began and should be regenerated after each phase.
