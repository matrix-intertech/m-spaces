# MatrixSpaces Permission Matrix

Date: 2026-06-05
Branch: `production-hardening`
Status: `Post Phase 1 pass`

## Role Matrix

| Role | View | Create | Edit | Delete | Assign | Manage | Transfer | Notes |
|---|---|---|---|---|---|---|---|---|
| Admin | Yes | Yes | Yes | Yes | Yes | Yes | Partial | Full admin role in property authorization |
| Support | Partial | Partial | Partial | No property delete | Partial | Moderation-focused | No | Support no longer inherits property-admin control |
| Builder | Yes | Yes | Yes | Partial | Yes | Scoped | No explicit transfer | Builder dashboard data now scoped for unassigned visits |
| Broker | Yes | Yes | Yes | Partial | Yes | Scoped | No explicit transfer | Broker dashboard payloads now scoped to managed properties/users |
| Associated Sales Agent | Yes | Yes | Yes | Limited | Limited | Parent-scoped | No | Scope still depends on parent/team relationships |
| Independent Sales Agent | Yes | Yes | Yes | Limited | Limited | Self-scoped + accepted requests | No | Independent management request flow preserved |
| Owner | Yes | Yes | Yes | Yes on own property | Yes | Own resources | Ownership declaration only | Owner-only routes now require owner role explicitly |
| Tenant | Public/user flows only | Limited inquiry flows | No owner edit | No | No | No owner manage | No | No longer normalized into owner |
| Buyer | Public/inquiry flows | Inquiry/chat/visit | No | No | No | No | No | Buyer is still not a first-class backend role |
| Guest | Public only | Signup/login/inquiry entry | No | No | No | No | No | Protected actions require session and CSRF |

## Key Boundary Changes In This Pass

- `support` removed from full property-admin role bucket
- `tenant` removed from owner-only route access
- broker dashboard payloads no longer ship global property/user lists
- builder unassigned visits no longer ship global visit lists

## Known Remaining Gaps

- Permission logic is still split across policies, helpers, and route-local checks.
- Admin/support separation inside admin modules is still permission-driven rather than fully policy-driven.
- Buyer remains an implicit flow rather than a dedicated user role model.
