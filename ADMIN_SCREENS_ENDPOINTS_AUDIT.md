# Admin Screens and Endpoint Implementation Audit

## 1) Architecture Snapshot

- **Routing framework**: Next.js App Router (`src/app`).
- **Primary admin route wrappers**:
  - `src/app/page.tsx` redirects to `/admin/overview`.
  - `src/app/admin/page.tsx` redirects to `/admin/overview`.
  - `src/app/admin/layout.tsx` wraps admin routes with `AdminAuthGate` + `AdminLayout` except `/admin/login`.
- **Screen implementation location**: `src/features/admin/screens/*`.
- **API client location**: `src/lib/api/admin-api.ts` and `src/lib/api/client.ts`.
- **Auth/session storage**: `src/lib/api/auth-storage.ts` (`admin_auth_v1` in localStorage).
- **Local API base URL**: `NEXT_PUBLIC_API_BASE_URL` (currently configured for local dev in `.env.local` as `http://localhost:8000`).

---

## 2) Route-to-Screen Map

1. `/` -> redirect to `/admin/overview`
2. `/admin` -> redirect to `/admin/overview`
3. `/admin/login` -> `AdminLoginForm`
4. `/admin/overview` -> `OverviewPage`
5. `/admin/security/alerts` -> `AlertsPage`
6. `/admin/security/sessions` -> `SessionsPage`
7. `/admin/security/audit` -> `AuditPage`
8. `/admin/permissions/catalog` -> `PermissionCatalogPage`
9. `/admin/permissions/templates` -> `RoleTemplatesPage`
10. `/admin/onboarding/cleaners` -> `CleanerOnboardingPage`
11. `not-found` -> `src/app/not-found.tsx`

---

## 3) Endpoint Inventory (Current `admin-api.ts`)

### Actively used by current screens

1. `POST /v1/admins/login` (`loginAdmin`)
2. `GET /v1/admins/profile` (`fetchAdminProfile`)
3. `GET /v1/admins/monitoring/overview` (`fetchMonitoringOverview`)
4. `GET /v1/admins/monitoring/auth/heatmap?days={days}` (`fetchAuthHeatmap`)
5. `GET /v1/admins/monitoring/alerts?...` (`fetchAlerts`)
6. `PATCH /v1/admins/monitoring/alerts/{alertId}/read` (`updateAlertReadState`)
7. `PATCH /v1/admins/monitoring/alerts/{alertId}/ack` (`updateAlertAckState`)
8. `GET /v1/admins/monitoring/sessions/anomalies` (`fetchSessionAnomalies`)
9. `POST /v1/admins/sessions/logout` (`revokeCurrentSession`)
10. `POST /v1/admins/sessions/revoke-others` (`revokeOtherSessions`)
11. `POST /v1/admins/sessions/revoke-all` (`revokeAllSessions`)
12. `GET /v1/admins/monitoring/alerts/sla?hours={hours}` (`fetchAlertSla`)
13. `GET /v1/admins/monitoring/permissions/denied-top?hours={hours}&limit={limit}` (`fetchDeniedPermissions`)
14. `GET /v1/admins/permissions/catalog` (`fetchPermissionCatalog`)
15. `GET /v1/admins/permission-templates/{role}` (`fetchRoleTemplate`)
16. `PUT /v1/admins/permission-templates/{role}` (`updateRoleTemplate`)
17. `POST /v1/admins/permission-templates/{role}/rollout` (`rolloutRoleTemplate`)
18. `POST /v1/admins/monitoring/audit/export` (`exportAuditLog`)
19. `PATCH /v1/admins/cleaners/{cleanerId}/onboarding-review` (`reviewCleanerOnboarding`)
20. `POST /v1/admins/refresh` (auto refresh inside `apiRequest` on 401)

### Implemented in API layer but currently not wired to any current screen UI

1. `GET /v1/admins?start={start}&stop={stop}` (`listAdmins`)
2. `POST /v1/admins/signup` (`createAdmin`)
3. `DELETE /v1/admins/account` (`deleteOwnAdminAccount`)

---

## 4) Screen-by-Screen Details (Design + Endpoint Implementation)

## 4.1 Admin Login (`/admin/login`)

### Design and UX implementation

- Card-centered login form with:
  - email input
  - password input
  - submit button
  - optional Auth0 forgot-password link derived from `NEXT_PUBLIC_AUTH0_RESET_PASSWORD_URL`.
- Loading state on submit (`Signing in...`).
- Inline API error display (`message` and optional `requestId`).

### Data flow

- Hook: `useAdminLogin` (`src/hooks/use-admin-auth.ts`).
- On success:
  - stores `access_token` + `refresh_token` in localStorage (`admin_auth_v1`),
  - invalidates `admin-profile` query,
  - redirects to `/admin/overview`.

### Endpoint implementation

1. **Login submit**
   - Endpoint: `POST /v1/admins/login`
   - Body source:
     - `email`: value from form state `email`
     - `password`: value from form state `password`
   - Called by: `loginAdmin(email, password)`

2. **Session validation after login / protected routes**
   - Endpoint: `GET /v1/admins/profile`
   - Called by `useAdminProfile` in `AdminAuthGate`

3. **Automatic token refresh when protected request returns 401**
   - Endpoint: `POST /v1/admins/refresh`
   - Authorization header: expired/current access token from localStorage
   - Body: `{ refresh_token }` from localStorage

---

## 4.2 Overview (`/admin/overview`)

### Design and UX implementation

- Dashboard with:
  - hero metric cards (login failures, active sessions, open alerts, MTTA/MTTR)
  - secondary performance cards (login successes, refresh failures, suspicious logins)
  - auth heatmap section
  - top threat sources panel (aggregated from alerts by source IP)
  - recent alerts list.
- Uses motion animations and badge severity styling.

### Data flow

- React Query keys:
  - `['overview']`
  - `['overview', 'heatmap']`
  - `['overview', 'alerts']`
  - `['overview', 'sla']`

### Endpoint implementation

1. `GET /v1/admins/monitoring/overview`
   - Used fields:
     - `login_failures_last_hour`
     - `active_admin_sessions`
     - `open_alert_count`
     - `login_success_last_hour`
     - `refresh_failures_last_hour`
     - `suspicious_login_successes_last_day`

2. `GET /v1/admins/monitoring/auth/heatmap?days=14`
   - Hard-coded days in current UI call.

3. `GET /v1/admins/monitoring/alerts?start=0&stop=4`
   - Used for “Recent Alerts” + threat source aggregation.

4. `GET /v1/admins/monitoring/alerts/sla?hours=24`
   - Used for MTTA/MTTR card.

---

## 4.3 Alerts (`/admin/security/alerts`)

### Design and UX implementation

- Filter controls:
  - status: `all | open | acknowledged`
  - unread-only toggle.
- Alert list rendered via `AlertCard` with action buttons:
  - acknowledge toggle
  - read/unread toggle
  - investigate button placeholder (no API yet).
- Empty state and loading/error text states.

### Data flow

- Query key: `['alerts', filter, unreadOnly]` for list.
- Mutations invalidate `['alerts']` after success.

### Endpoint implementation

1. **List alerts**
   - Endpoint: `GET /v1/admins/monitoring/alerts`
   - Query params source:
     - `status` from filter button state (`open/acknowledged`, omitted for all)
     - `unreadOnly` from toggle state
     - `start=0`, `stop=50` fixed in screen

2. **Toggle read state**
   - Endpoint: `PATCH /v1/admins/monitoring/alerts/{alertId}/read`
   - Path param source:
     - `alertId` from `AlertCard` current alert `_id`
   - Body:
     - `{ is_read: boolean }` from local card toggle next state

3. **Toggle acknowledge state**
   - Endpoint: `PATCH /v1/admins/monitoring/alerts/{alertId}/ack`
   - Path param source:
     - `alertId` from `AlertCard` current alert `_id`
   - Body:
     - `{ ack: boolean }` from local card toggle next state

---

## 4.4 Sessions (`/admin/security/sessions`)

### Design and UX implementation

- Metric cards:
  - global active sessions
  - long-lived sessions
  - session spike status.
- “Active sessions by admin” list sorted descending by count.
- Three destructive/critical actions each with confirmation dialog:
  - revoke current
  - revoke others
  - revoke all.

### Data flow

- Query key: `['session-anomalies']`.
- All revoke mutations invalidate `['session-anomalies']` on success.

### Endpoint implementation

1. `GET /v1/admins/monitoring/sessions/anomalies`
2. `POST /v1/admins/sessions/logout`
3. `POST /v1/admins/sessions/revoke-others`
4. `POST /v1/admins/sessions/revoke-all`

---

## 4.5 Audit (`/admin/security/audit`)

### Design and UX implementation

- Form-driven export screen (not a live table):
  - actor ID
  - target ID
  - endpoint
  - start epoch
  - end epoch
- Submit button with pending/success/error UI messages.

### Data flow

- Single mutation call; no query list backing this screen.

### Endpoint implementation

1. `POST /v1/admins/monitoring/audit/export`
   - Body source:
     - `actor_id`: actor input or `null`
     - `target_id`: target input or `null`
     - `endpoint`: endpoint input or `null`
     - `start_epoch`: parsed number from input or `null`
     - `end_epoch`: parsed number from input or `null`
     - `limit`: fixed `500`

---

## 4.6 Permission Catalog (`/admin/permissions/catalog`)

### Design and UX implementation

- “Top Denied Permissions (24h)” list with:
  - permission key
  - admins list
  - denied count badge.
- “Catalog Snapshot” badges grouped by resource and route count.
- Loading/error states for both data blocks.

### Data flow

- Query keys:
  - `['permissions', 'denied-top']`
  - `['permissions', 'catalog']`

### Endpoint implementation

1. `GET /v1/admins/monitoring/permissions/denied-top?hours=24&limit=10`
2. `GET /v1/admins/permissions/catalog`

---

## 4.7 Role Templates (`/admin/permissions/templates`)

### Design and UX implementation

- Two template sections (`cleaner`, `customer`), each with:
  - permission count badge
  - local add-permission sheet (name/method/path)
  - delete permission action
  - save button
  - rollout confirmation dialog.
- Loads current template from backend then hydrates local editable arrays.

### Data flow

- Query keys:
  - `['role-template', 'cleaner']`
  - `['role-template', 'customer']`
- Save invalidates `['role-template']`.
- Rollout currently triggers mutation but does not explicitly refetch after success.

### Endpoint implementation

1. `GET /v1/admins/permission-templates/cleaner`
2. `GET /v1/admins/permission-templates/customer`
3. `PUT /v1/admins/permission-templates/{role}`
   - Path param source: section role (`cleaner` or `customer`)
   - Body source: local editable permission array
   - Body shape: `{ permissionList: { permissions: Permission[] } }`
4. `POST /v1/admins/permission-templates/{role}/rollout`
   - Path param source: section role

---

## 4.8 Cleaner Onboarding Review (`/admin/onboarding/cleaners`)

### Design and UX implementation

- Current implementation is a **direct review submission form**, not queue-driven detail workflow.
- Form fields:
  - Cleaner ID input
  - Decision toggle (`APPROVED` / `REJECTED`)
  - Rejection reason textarea (enabled only when rejected)
- Validation:
  - cannot submit without cleaner ID
  - rejection requires non-empty reason
- Shows in-session recent decision log after successful submissions.

### Data flow

- Mutation in screen directly calls `reviewCleanerOnboarding`.
- On success:
  - append entry to local `decisionLog`
  - clear rejection reason when rejected decision was submitted
  - toast success.
- On error:
  - toast with API message and optional request ID.

### Endpoint implementation

1. `PATCH /v1/admins/cleaners/{cleanerId}/onboarding-review`
   - **Path param source (`cleanerId`)**:
     - `cleanerId` is read from the **Cleaner ID input field**, trimmed (`cleanerId.trim()`).
     - It is **not selected from API queue data** in this current page implementation.
   - Body source:
     - `status`: current decision state (`APPROVED` or `REJECTED`)
     - `rejection_reason`:
       - rejection textarea trimmed value when status is `REJECTED`
       - `null` when status is `APPROVED`

### Important implementation note

- `OnboardingQueue` / `OnboardingDetail` components still exist in the codebase, but this current screen version does not use them; it uses manual `cleanerId` entry for direct backend review call.

---

## 5) Auth and API Behavior Details (Cross-Cutting)

1. **Bearer token injection**
   - `apiRequest` adds `Authorization: Bearer <accessToken>` when `auth=true`.

2. **Refresh behavior**
   - On any 401, `apiRequest` attempts one refresh call to `POST /v1/admins/refresh` and retries once.
   - Single-flight refresh promise prevents parallel refresh storms.

3. **Refresh request composition**
   - Header: `Authorization: Bearer <current access token>`
   - Body: `{ refresh_token: <stored refresh token> }`

4. **Logout behavior on refresh failure**
   - Auth storage is cleared.

---

## 6) Endpoint Matrix (Consolidated)

| Endpoint | Method | Screen(s) | Input source | Response usage |
|---|---|---|---|---|
| `/v1/admins/login` | POST | Login | Email/password form | tokens saved to localStorage |
| `/v1/admins/profile` | GET | Auth gate | access token | protected-route validation |
| `/v1/admins/refresh` | POST | Global client | stored tokens on 401 | access/refresh token rotation |
| `/v1/admins/monitoring/overview` | GET | Overview | none | top-level KPI cards |
| `/v1/admins/monitoring/auth/heatmap` | GET | Overview | `days=14` fixed | heatmap cells |
| `/v1/admins/monitoring/alerts` | GET | Overview, Alerts, CommandBar | filters + pagination | alerts lists |
| `/v1/admins/monitoring/alerts/{alertId}/read` | PATCH | Alerts | `alertId` from card `_id`, `is_read` toggle | mutation side-effect |
| `/v1/admins/monitoring/alerts/{alertId}/ack` | PATCH | Alerts | `alertId` from card `_id`, `ack` toggle | mutation side-effect |
| `/v1/admins/monitoring/sessions/anomalies` | GET | Sessions | none | session metrics/list |
| `/v1/admins/sessions/logout` | POST | Sessions | action click | session revoke action |
| `/v1/admins/sessions/revoke-others` | POST | Sessions | action click | session revoke action |
| `/v1/admins/sessions/revoke-all` | POST | Sessions | action click | session revoke action |
| `/v1/admins/monitoring/alerts/sla` | GET | Overview | `hours=24` fixed | MTTA/MTTR card |
| `/v1/admins/monitoring/permissions/denied-top` | GET | Permission Catalog | `hours=24&limit=10` fixed | denied permissions list |
| `/v1/admins/permissions/catalog` | GET | Permission Catalog | none | grouped resource snapshot |
| `/v1/admins/permission-templates/{role}` | GET | Role Templates | role section (`cleaner/customer`) | initial permission arrays |
| `/v1/admins/permission-templates/{role}` | PUT | Role Templates | role section + local edited permissions | save update |
| `/v1/admins/permission-templates/{role}/rollout` | POST | Role Templates | role section | rollout action |
| `/v1/admins/monitoring/audit/export` | POST | Audit | form fields | export request status |
| `/v1/admins/cleaners/{cleanerId}/onboarding-review` | PATCH | Cleaner Onboarding | cleaner ID text input + decision/reason | review submission |

---

## 7) Current Mismatches, Gaps, and Notes

1. Cleaner onboarding page currently requires manual cleaner ID input; there is no list/selection API wired in this current screen.
2. Audit page is export-only; no audit log list endpoint is currently wired for table/history.
3. Role template rollout mutation does not currently trigger an explicit cache invalidation after success.
4. `listAdmins`, `createAdmin`, and `deleteOwnAdminAccount` are implemented in API client but not yet connected to visible screens.
5. to add new permissions you don't get to see a list of available permissions/endpoints and briefs on what they do before adding which is terrible for user experience
6. User management and details for reporting like number of signups of cleaners and customer's important reporting details and summaries of the user's that have signed up so far 

