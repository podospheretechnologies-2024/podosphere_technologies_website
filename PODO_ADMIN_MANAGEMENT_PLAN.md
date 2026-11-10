# Admin, Team & Client Management Plan

## Industry-Best Approach for Podosphere Social

---

## Current State (What Already Exists)

### Roles
| Role | Scope | Current Capability |
|------|-------|--------------------|
| **Platform Admin** (`isPlatformAdmin`) | Cross-org | `/admin` panel: list all orgs, sync health, AI usage, impersonate any OWNER |
| **OWNER** | Org-wide | Full access to all clients, channels, settings. Can invite team members |
| **ADMIN** | Org-wide | Same as OWNER except can't delete org or transfer ownership |
| **MEMBER** | Client-scoped | Locked to assigned clients via `SocialClientMember` with granular permissions |

### Working Features
- `/admin` — Super admin panel (org list, sync health, impersonate)
- `/dashboard/team` — Invite members (email + ADMIN/MEMBER role), view active members, revoke invites
- `/dashboard/social/clients` — Add clients, assign channels/ad accounts, magic links, templates
- `/approver/portal` — White-labeled client portal (approval queue, overview, channels)
- Client switcher dropdown (OWNER/ADMIN see "All clients", MEMBER locked to their assigned client)
- Plan limits enforced (maxClients, maxUsers, maxChannels per plan tier)
- Billing page with Razorpay checkout

### Permission System (Built but Unused)
The `SocialClientMember` model + `access.ts` already support granular permissions:
`view | draft | publish | approve | inbox | ads_view | ads_manage | leads | reports`

**Problem: 0 rows in SocialClientMember** — no MEMBER users have been assigned to any client.

---

## What's Missing (Gaps)

| # | Gap | Impact |
|---|-----|--------|
| 1 | **No Organization Settings page** | Can't edit org name, logo, brand color, portal title, custom domain |
| 2 | **No User Profile page** | Can't change your own name, email, or password |
| 3 | **No Client-Member assignment UI** | MEMBER role is useless — no way to assign members to clients with permissions |
| 4 | **No role editing after invite** | Can't promote MEMBER→ADMIN or demote ADMIN→MEMBER |
| 5 | **No member removal/deactivation** | Can't remove a team member who left the agency |
| 6 | **No audit log UI** | `AuditLog` model exists but no dashboard to view it |
| 7 | **Team page not in social nav** | `/dashboard/team` exists but isn't linked from the social dashboard sidebar |
| 8 | **Client onboarding stuck** | All 8 clients stuck at `onboardingStep: "created"`, channels not linked |
| 9 | **Duplicate clients** | 7 duplicate "Podosphere Technologies" clients to clean up |

---

## The Plan: 4 Phases

### Phase 1: Organization & Profile Settings (Foundation)
**Goal: OWNER/ADMIN can configure the agency and users can manage their own profile**

#### 1A. Organization Settings Page (`/dashboard/social/settings/organization`)
Add a new tab "Organization" to the existing Settings panel, or create a dedicated page.

**Fields to expose:**
```
Organization Name          [text input]
Logo                       [image upload → S3/R2 → logoUrl]
Brand Color                [color picker → primaryColor / themeColor]
Portal Title               [text input → portalTitle]
Custom Domain              [text input → customDomain]  (OWNER only)
GSTIN                      [text input → buyerGstin]    (billing)
Place of Supply            [text input → placeOfSupply]  (billing)
```

**Access:** OWNER + ADMIN (except custom domain = OWNER only)

**API:** `PUT /api/social/settings/organization`

#### 1B. User Profile Page (`/dashboard/social/settings/profile`)
A personal settings page for any logged-in user.

**Fields:**
```
Name                       [text input]
Email                      [text input, requires re-verification]
Change Password            [current + new + confirm]
```

**API:** `PUT /api/auth/me` (name/email), `PUT /api/auth/me/password`

#### 1C. Add "Settings" Hub to Nav
Restructure the Settings page as a hub with tabs:
- **Content** (existing: sets, signatures, tags, hashtags)
- **Organization** (new: 1A above)
- **Profile** (new: 1B above)
- **Team** (link to `/dashboard/team` or embed)

---

### Phase 2: Team Management Enhancement
**Goal: Full team lifecycle — invite, assign, edit, remove**

#### 2A. Enhance `/dashboard/team`

**Current state:** Invite by email (ADMIN/MEMBER), view list, revoke invites.

**Add:**

| Feature | Industry Standard | Implementation |
|---------|-------------------|----------------|
| **Edit role** | Dropdown on member row | `PATCH /api/team/members/:id` — only OWNER can change roles |
| **Remove member** | Soft-delete with confirmation | `DELETE /api/team/members/:id` — sets `deletedAt`, revokes session |
| **Deactivate/reactivate** | Toggle without deletion | Could use `deletedAt` as suspension flag, or add `status` field |
| **Client assignment** | Multi-select per member | New UI section or modal (see 2B) |
| **Last activity** | Show in member table | Already have `lastLoginAt` |
| **Search/filter** | Filter by role, sort by name/date | Client-side for now (< 50 users per plan) |

#### 2B. Client-Member Permission Matrix
**The key missing piece.** MEMBER users need to be assigned to specific clients with specific permissions.

**UI Approach (industry best: Notion/Linear style):**

```
┌────────────────────────────────────────────────────────────┐
│  Team Member: Rahul Sharma (MEMBER)                        │
│                                                            │
│  Assigned Clients:                                         │
│  ┌──────────────────┬────────────────────────────────────┐ │
│  │ Client           │ Permissions                        │ │
│  ├──────────────────┼────────────────────────────────────┤ │
│  │ Kotech Digital   │ ☑ View  ☑ Draft  ☐ Publish       │ │
│  │                  │ ☐ Approve  ☑ Inbox  ☐ Ads        │ │
│  ├──────────────────┼────────────────────────────────────┤ │
│  │ Heritage Weaves  │ ☑ View  ☑ Draft  ☑ Publish       │ │
│  │                  │ ☑ Approve  ☑ Inbox  ☐ Ads        │ │
│  └──────────────────┴────────────────────────────────────┘ │
│                                                            │
│  [+ Assign to another client]                              │
└────────────────────────────────────────────────────────────┘
```

**APIs:**
- `GET /api/team/members/:id/clients` — list assigned clients + permissions
- `PUT /api/team/members/:id/clients` — bulk update client assignments
- or individual: `POST/DELETE /api/team/members/:id/clients/:clientId`

**DB:** Writes to existing `SocialClientMember` table (already has `userId`, `customerId`, `organizationId`, `permissions` JSON)

#### 2C. Invitation Enhancement
When inviting a MEMBER, let the inviter pre-select which clients the new member will have access to:
```
Email:  [________________]
Role:   [MEMBER ▼]
Clients: [☑ Kotech  ☑ Heritage Weaves  ☐ Franco Leone]
```

Store the selection in `Invitation.clientAccess` (JSON field, already exists!) and apply it when the invite is accepted.

---

### Phase 3: Client Lifecycle Management
**Goal: Complete client onboarding, cleanup, and monitoring**

#### 3A. Fix Client Data (Immediate)
Run a cleanup script:
1. Delete 7 duplicate "Podosphere Technologies" clients (keep 1 if needed for agency's own content)
2. Link the 114 unlinked channels to appropriate clients
3. Mark Facebook pages with `refreshNeeded` for reconnection

#### 3B. Client Onboarding Wizard
The onboarding flow already exists at `/dashboard/social/clients/[id]/onboarding` — complete the steps:

| Step | Status | What Happens |
|------|--------|-------------|
| `created` | All stuck here | Client record created |
| `channels_linked` | Not reached | Channels assigned to client |
| `approver_invited` | Not reached | Magic link sent, approver logged in |
| `active` | Not reached | Client portal shows real data |

#### 3C. Client Dashboard View
Inside each client, show:
- Connected channels (IG + FB pages)
- Assigned team members
- Pending approvals count
- Last 30 days performance (followers, reach, engagement)
- Quick actions (edit links, send magic link, generate report)

#### 3D. Client Deletion/Archive
- **Archive**: Hide from active list, stop scheduled posts, keep data
- **Delete**: Soft-delete, unlink channels (return to unassigned pool), remove member assignments

---

### Phase 4: Super Admin Enhancement
**Goal: Platform-level management for Podosphere as a business**

#### 4A. Enhance `/admin` Dashboard
Current: org list, sync health, AI usage.

**Add:**
| Feature | Purpose |
|---------|---------|
| **Organization detail view** | Click into an org → see its members, clients, channels, billing status |
| **User search (cross-org)** | Find any user by email across all organizations |
| **Subscription status** | Show which orgs are on which plan, billing status, revenue |
| **Bulk actions** | Suspend org, change plan, reset password for user |
| **Activity feed** | Show recent AuditLog entries across all orgs |
| **Channel health** | Global view of `refreshNeeded` channels by org |

#### 4B. Impersonation Improvements
Current: Can impersonate any org OWNER.

**Add:**
- Impersonate any user (not just OWNER) — useful to debug MEMBER permissions
- Impersonation audit trail (already logged via `impersonatedBy` in AccessContext)
- Visual banner showing "You are viewing as [User] in [Org]" (already exists: `impersonation-banner.tsx`)

---

## Summary: Role Hierarchy (Industry Best Practice)

```
┌─────────────────────────────────────────────────────────────┐
│  PLATFORM ADMIN (isPlatformAdmin = true)                     │
│  ├── See ALL organizations                                   │
│  ├── Impersonate any user                                    │
│  ├── View platform health (syncs, AI cost, billing)          │
│  └── Manage plans and subscriptions                          │
│                                                              │
│  OWNER (per organization)                                    │
│  ├── All client access (no restrictions)                     │
│  ├── Manage team (invite/edit role/remove)                   │
│  ├── Manage organization settings (name, logo, domain)       │
│  ├── Manage billing and plan                                 │
│  ├── Connect/disconnect channels                             │
│  ├── Create/delete clients                                   │
│  └── Transfer ownership                                      │
│                                                              │
│  ADMIN (per organization)                                    │
│  ├── All client access (no restrictions)                     │
│  ├── Manage team (invite/remove, can't change OWNER)         │
│  ├── Manage org settings (except domain/billing)             │
│  ├── Connect/disconnect channels                             │
│  └── Create/edit clients                                     │
│                                                              │
│  MEMBER (per organization, client-scoped)                    │
│  ├── Only sees assigned clients                              │
│  ├── Per-client permissions:                                 │
│  │   ├── view     — see client dashboard                     │
│  │   ├── draft    — create/edit draft posts                  │
│  │   ├── publish  — schedule or publish                      │
│  │   ├── approve  — manage approval workflows                │
│  │   ├── inbox    — read/reply in social inbox               │
│  │   ├── ads_view — view ad campaigns                        │
│  │   ├── ads_manage — create/modify ads                      │
│  │   ├── leads    — view/manage leads                        │
│  │   └── reports  — view/generate reports                    │
│  └── Personal profile settings only                          │
│                                                              │
│  CLIENT APPROVER (external, via magic link)                  │
│  ├── White-labeled portal                                    │
│  ├── Approve/reject posts                                    │
│  ├── View connected channels & performance                   │
│  └── Connect their own social accounts                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Recommended Build Order

| Priority | Task | Effort | Depends On |
|----------|------|--------|------------|
| **P0** | Clean up duplicate clients + link channels | 1 hr | — |
| **P0** | Add Team page link to social nav | 15 min | — |
| **P1** | Organization Settings page (1A) | 1 day | — |
| **P1** | User Profile page (1B) | 1 day | — |
| **P1** | Client-Member assignment UI (2B) | 2 days | Team page |
| **P1** | Edit role / Remove member (2A) | 1 day | Team page |
| **P2** | Settings hub restructure (1C) | 0.5 day | 1A + 1B |
| **P2** | Invitation client pre-selection (2C) | 0.5 day | 2B |
| **P2** | Client onboarding completion (3B) | 1 day | 3A |
| **P3** | Client detail dashboard (3C) | 2 days | 3B |
| **P3** | Client archive/delete (3D) | 0.5 day | — |
| **P3** | Super admin enhancements (4A) | 2 days | — |
| **P4** | Audit log UI | 1 day | — |

**Total estimated effort: ~12 days**

---

## Industry References

This design follows patterns from:
- **Hootsuite / Sprout Social**: Agency → Client → Channel with per-client team permissions
- **Linear / Notion**: Clean permission matrix UI, invite-with-role, granular access
- **Buffer**: Simple role hierarchy (Admin → Manager → Contributor) with channel-level access
- **HubSpot**: Team-based permissions with object-level access (contacts, deals → our clients, channels)
- **Vercel**: Organization settings (logo, domain) as separate page, team management with role editing
