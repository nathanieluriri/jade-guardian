# Admin Frontend Platform (Phase 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin console onto the new backend auth platform (email-OTP + TOTP login, invite/temp-password flow, httpOnly cookies, access presets) and give it VisiChek-grade presentation: two-state login, branded Lottie boot splash, TOTP enrollment stepper, invite/preset management, and a design-system pass.

**Architecture:** Next 15 App Router + TanStack Query + shadcn/Radix (all already present). Auth moves from localStorage bearer tokens to httpOnly cookies, with the API proxied through Next rewrites so cookies are first-party. A non-sensitive `admin_auth_hint` flag drives the synchronous route guard; the profile query is the real authority.

**Tech Stack:** Next 15.5, React 18, TanStack Query 5, react-hook-form + zod, framer-motion, `input-otp` (already a dep), lucide-react, sonner, next-themes, Tailwind + shadcn. One new dependency: a Lottie player for the boot splash.

## Global Constraints

- Branch `feature/admin-frontend-platform` off current `master` (HEAD `d8cb5ec`).
- Backend contract is authoritative: read `C:\Users\Mr Dashi\Downloads\Marcus-cleaning-backend\app\docs\ADMIN_AUTH.md` before Task 1 and treat it as the spec for every request/response shape and error code.
- **Cookie transport decision (do not deviate):** the browser must call the API on its own origin so the backend's `SameSite=Lax` admin cookies are first-party. Add a Next rewrite mapping `/api/:path*` → `${API_ORIGIN}/api/:path*` and make the API client use relative `/api/...` URLs. `ADMIN_COOKIE_DOMAIN` must stay unset on the backend. Never switch the backend to `SameSite=None` to work around this.
- Every request that needs auth sends `credentials: "include"`. No access/refresh token is ever written to `localStorage` or `sessionStorage` again.
- Envelope: `{success, message, data, requestId}`; error code lives at `data.code` (the existing `parseError` already reads it).
- Design tokens only — no hardcoded hex/rgb in components; use the CSS variables in `src/index.css` and Tailwind theme tokens. Brand green stays this project's own; VisiChek is copied for *composition and interaction*, not colour.
- Accessibility: every new interactive element keyboard-reachable; loading regions `role="status"`; error banners `role="alert"`; respect `prefers-reduced-motion` in the splash and transitions.
- Tests: Vitest + Testing Library (`npm test`). The suite currently holds one placeholder test (`src/test/example.test.ts`) — new tests are real coverage. Playwright config exists (`playwright.config.ts`) for the Task 9 smoke spec. Run `npm test`, `npx tsc --noEmit -p tsconfig.json`, and `npm run lint` per task; all must pass.
- Commit per task with the given message and trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Do not reformat or restructure the 30+ existing feature screens. Touch them only where a task names them.

## Backend surface this phase consumes

`POST /api/v1/admins/login` → either `{otpRequired: true, otpChallengeId, method: "email"|"totp"}` or (legacy flag off) `{admin, tokens}`; `POST /admins/verify-otp` `{challengeId, code}`; `POST /admins/refresh`; `POST /admins/logout`; `POST /admins/change-password` `{currentPassword, newPassword}`; `POST /admins/2fa/setup` → `{secret, otpauthUri}` (requires `{code}` when TOTP already enabled); `POST /admins/2fa/verify` `{code}` → `{backupCodes}`; `DELETE /admins/2fa` `{code}`; `POST /admins/2fa/backup-codes/regenerate` `{code}`; `POST /admins/invites` `{email, fullName, accessPreset}`; `POST /admins/invites/{admin_id}/resend`; `GET /admins/access-presets`; `PATCH /admins/{admin_id}/access-preset` `{preset}`; `POST /admins/access-presets/bulk` `{adminIds, preset}`; `GET /admins/profile`.
Error codes to branch on: `INVALID_CREDENTIALS`, `TEMP_PASSWORD_EXPIRED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED` (429), `TOTP_INVALID`, `PASSWORD_CHANGE_REQUIRED` (403), `FORBIDDEN` (403).

---

### Task 1: Cookie auth transport + DTO alignment

**Files:**
- Modify: `next.config.mjs` (rewrite), `src/lib/api/client.ts`, `src/lib/api/auth-storage.ts`, `src/lib/api/types.ts`, `src/lib/admin-access.ts`
- Create: `src/test/setup-msw.ts` is NOT needed — stub `global.fetch` per test instead
- Test: `src/test/api-client.test.ts`, `src/test/admin-access.test.ts`

**Interfaces (consumed by every later task):**
- `next.config.mjs`: `async rewrites() { return [{ source: '/api/:path*', destination: `${process.env.API_ORIGIN ?? 'https://marcus-cleaning-backend.vercel.app'}/api/:path*` }] }`.
- `client.ts`: `API_BASE_URL` becomes `""` (relative). `apiRequest` always passes `credentials: "include"`; drops the `Authorization` header entirely; keeps the single-flight refresh but calls `POST /api/v1/admins/refresh` with an empty body (the refresh cookie carries it) and treats a 2xx as success (no token reading). On refresh failure it clears the auth hint and rejects.
- `auth-storage.ts` is rewritten to hold only a non-sensitive hint — **no tokens**:
  ```ts
  export const AUTH_HINT_KEY = "admin_auth_hint_v1";
  export function hasAuthHint(): boolean;      // synchronous, for the guard tripwire
  export function setAuthHint(): void;
  export function clearAuthHint(): void;
  ```
  Delete `AdminAuthState`, `getAuthState`, `setAuthState`, `clearAuthState` and update every caller (grep: `getAuthState` appears in `use-admin-auth.ts`, `AdminAuthGate.tsx`, `src/app/admin/page.tsx`, `src/features/admin/screens/AuditPage.tsx` — AuditPage builds a manual download URL with a bearer token; switch it to a `credentials: "include"` fetch with no token).
- `types.ts`: `AdminLoginResponse` becomes a union — `{ otpRequired: true; otpChallengeId: string; method: "email" | "totp" }` | `{ admin: AdminProfile; tokens: TokenResponse | null }`; `TokenResponse` fields become camelCase (`accessToken`, `refreshToken`, `tokenType`, `expiresIn`, `language`) matching the backend — the current snake_case DTOs are a real bug (login/refresh silently stored `undefined`). Add `AdminProfile.accessPreset: string | null`, `mustChangePassword: boolean`, `totpEnabled: boolean`, and allow `permissionList` to be `string[] | { permissions: Array<string | {key?, path, methods}> }`.
- `admin-access.ts`: `getProfilePermissions` normalizes both containers — if `permissionList` is an array use it directly, else use `permissionList.permissions`. Also treat `isSuperAdmin === true` or a `"*"` entry as "all permissions allowed" (return true from `canAccessAdminRoute`/`canAccessAdminAction` early). Everything else in the file stays.

- [ ] **Step 1: Write failing tests**

`src/test/api-client.test.ts` — stub `global.fetch` with a `vi.fn()`:
```ts
it("sends credentials and no Authorization header", async () => { /* assert init.credentials === "include" and !headers.has("authorization") */ });
it("uses a relative /api path so cookies are first-party", async () => { /* assert fetch called with "/api/v1/admins/profile" */ });
it("refreshes once on 401 then replays the request", async () => { /* 401, then 200 on refresh, then 200 replay; assert 3 calls and one refresh */ });
it("clears the auth hint when refresh fails", async () => { /* 401 + refresh 401 → hint cleared, request rejects */ });
```
`src/test/admin-access.test.ts`:
```ts
it("accepts a flat permissionList array of METHOD:/path keys", ...);
it("accepts the nested permissionList.permissions container", ...);
it("grants everything to a super admin", ...);
it("grants everything when the list contains '*'", ...);
it("denies a route whose requirement is absent", ...);
```

- [ ] **Step 2: Run** `npm test` → FAIL (files/behaviour missing).
- [ ] **Step 3: Implement** per the interfaces above.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npm run lint` → green. Fix every call site the type changes break (expect `use-admin-auth.ts`, `AdminAuthGate.tsx`, `admin-api.ts`, `AuditPage.tsx`).
- [ ] **Step 5: Commit** `feat(admin-web): cookie-based auth transport and DTO alignment`

---

### Task 2: Auth hook — OTP challenge, change-password gate, logout

**Files:**
- Modify: `src/hooks/use-admin-auth.ts`, `src/lib/api/admin-api.ts`
- Test: `src/test/use-admin-auth.test.ts`

**Interfaces (consumed by Tasks 3–5):**
- `admin-api.ts` gains, all returning unwrapped `data`: `loginAdmin(email, password)` (typed to the union), `verifyAdminOtp(challengeId, code)`, `changeAdminPassword(currentPassword, newPassword)`, `logoutAdmin()`, `setupTotp(code?)`, `verifyTotp(code)`, `disableTotp(code)`, `regenerateBackupCodes(code)`, `inviteAdmin({email, fullName, accessPreset})`, `resendAdminInvite(adminId)`, `listAccessPresets()`, `setAdminAccessPreset(adminId, preset)`, `bulkSetAdminAccessPreset(adminIds, preset)`.
- `use-admin-auth.ts`:
  ```ts
  export type LoginStep = { kind: "credentials" } | { kind: "otp"; challengeId: string; method: "email" | "totp"; email: string };
  export function useAdminLoginFlow(): {
    step: LoginStep;
    submitCredentials: (v: {email: string; password: string}) => Promise<void>;
    submitOtp: (code: string) => Promise<void>;
    backToCredentials: () => void;
    error: string | null;      // already mapped to friendly copy
    isPending: boolean;
  };
  export function useAdminProfile();               // unchanged shape, `enabled: hasAuthHint()`
  export function useAdminLogout();                // calls logoutAdmin(), clears hint + query cache, replaces to /admin/login
  export function useChangePassword();             // mutation; on success clears the gate and refetches profile
  ```
  Success path: credentials → if `otpRequired`, move to the `otp` step (no hint set yet); OTP verify → `setAuthHint()`, invalidate + fetch profile, then `router.replace(profile.mustChangePassword ? "/admin/change-password" : resolveFirstAllowedAdminRoute(profile))`. Legacy (flag off) response with `admin` present short-circuits straight to that same redirect.
- `src/lib/api/auth-errors.ts` (new): `export function adminAuthErrorCopy(error: ApiError): string` mapping the codes in the surface list above — `OTP_LOCKED` → "Too many incorrect codes. Start again to get a new one."; `OTP_EXPIRED` → "That code expired. Request a new one."; `OTP_INVALID` → "That code isn't right. Check and try again."; `TEMP_PASSWORD_EXPIRED` → "Your temporary password expired. Ask an admin to resend your invite."; `INVALID_CREDENTIALS` → "That email and password don't match."; 429 without a code → "Too many attempts. Wait a minute and try again."; default → `error.message`.

- [ ] **Step 1: Failing tests** — render the hook with a stubbed fetch: credentials → otp step exposed with challengeId/method; wrong code sets mapped error and stays on the otp step; `OTP_LOCKED` sets the lockout copy; successful verify sets the hint and redirects; `mustChangePassword: true` redirects to `/admin/change-password`; logout clears the hint.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4:** `npm test` + typecheck + lint green.
- [ ] **Step 5: Commit** `feat(admin-web): OTP login flow, change-password and cookie logout`

---

### Task 3: Login screen rebuild (two-state) + change-password screen

**Files:**
- Modify: `src/components/auth/AdminLoginForm.tsx`, `src/app/admin/login/page.tsx` (locate it first; keep the route path)
- Create: `src/components/ui/otp-input.tsx`, `src/app/admin/change-password/page.tsx`, `src/features/auth/components/change-password-screen.tsx`
- Test: `src/test/login-screen.test.tsx`, `src/test/change-password-screen.test.tsx`

**Reference (read before writing, port composition not colour):** `C:\Users\Mr Dashi\Downloads\visicheck\visichek-app-frontend\src\app\(public)\admin\login\page.tsx`, `src\components\ui\otp-input.tsx`, `src\features\auth\components\change-password-screen.tsx`.

**Interfaces:**
- `otp-input.tsx`: `<OtpInput length={6} value onChange onComplete disabled autoFocus />` — six boxed slots built on the existing `input-otp` dep, paste handling, arrow/backspace navigation, auto-advance, `onComplete` fires when full. Boxes use token borders and the brand focus ring; `inputMode="numeric"`, `autoComplete="one-time-code"`.
- Login screen composition: centred `max-w-[440px]` column; logo/wordmark block above the card (`public/company_logo.png` exists); card `rounded-3xl border shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)] p-8` using token colours; heading/subheading swap between "Admin sign-in" and "Two-factor authentication"; inputs `rounded-xl py-3 pl-10` with a leading lucide icon that takes the brand colour on `group-focus-within`, password eye toggle, `text-base md:text-sm`, `min-h-[48px]`; primary button `rounded-xl` with inline `Loader2` + label swap ("Signing in…") and trailing `ArrowRight`, `active:scale-[0.98]`; inline error pill (`role="alert"`) above the button; footer trust row with a `ShieldCheck` line. OTP state: brand-tinted circular `KeyRound` badge, centred label naming the method ("We emailed a 6-digit code to {email}" / "Enter the code from your authenticator app"), spam-folder hint for the email method, `OtpInput` auto-submitting on completion, "Back to sign-in" link, and on `OTP_LOCKED` return to the credentials state with the lockout copy shown.
- Change-password screen: same card language; current + new + confirm fields with a client-side match check and the backend's 8-char minimum; on success toast then `router.replace(resolveFirstAllowedAdminRoute(profile))`. Reached both from the `mustChangePassword` redirect and from settings.

- [ ] **Step 1: Failing tests** — login: renders credentials state; submitting moves to OTP state showing the masked email; entering 6 digits auto-submits and lands on the dashboard route; `OTP_INVALID` shows the mapped copy and keeps the OTP state; `OTP_LOCKED` returns to credentials with lockout copy; the Google-style trust footer and `role="alert"` pill exist. change-password: mismatch blocks submit; success calls the API with both fields.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4:** tests + typecheck + lint green; no hardcoded colours introduced.
- [ ] **Step 5: Commit** `feat(admin-web): two-state OTP login and change-password screens`

---

### Task 4: Branded boot splash (Lottie) + bootstrap gate + route skeletons

**Files:**
- Modify: `package.json` (add `@lottiefiles/dotlottie-react`), `src/app/providers.tsx`, `src/components/auth/AdminAuthGate.tsx`, `src/components/AdminLoadingState.tsx`
- Create: `src/components/auth/branded-splash.tsx`, `src/components/feedback/page-skeleton.tsx`, `src/components/feedback/table-skeleton.tsx`, plus `loading.tsx` files for the heaviest admin route groups (`src/app/admin/loading.tsx` at minimum, then `access/`, `operations/`, `support/`, `governance/`)
- Test: `src/test/branded-splash.test.tsx`

**Assets already in the repo:** `public/marcus_loading_animations/Cleaning.lottie` and `Scrub Brush (Edit).lottie` (+ `.json` twins). Use `Cleaning.lottie` for the full-screen splash and `Scrub Brush (Edit).lottie` for the compact in-app loader. Load from `/marcus_loading_animations/...` (URL-encode the space).

**Interfaces:**
- `BrandedSplash` — pure presentation, no session reads: full-screen token background; the Cleaning Lottie at ~160px (`autoplay loop`); wordmark fade-up at 320ms; a rotating tip card (5–7 short admin tips, `Lightbulb` icon, uppercase "TIP" eyebrow, 6s rotation, random start index chosen in a mount effect to avoid hydration mismatch); a 3px indeterminate brand progress bar pinned to the bottom; `role="status"` with an `sr-only` "Loading the admin console, please wait."; under `prefers-reduced-motion` the Lottie renders a static first frame and all fades/slides are disabled.
  ```ts
  export function BrandedSplash(props: { label?: string }): JSX.Element;
  ```
- `BootstrapGate` in `providers.tsx`: wraps children, shows `BrandedSplash` until the first profile resolution settles when a hint exists, with `MIN_VISIBLE_MS = 1600` (no flash) and `SAFETY_TIMEOUT_MS = 10_000` (never trap the user behind a hung API). With no auth hint it renders children immediately so the login route paints instantly.
- `AdminLoadingState` keeps its signature but renders the compact Scrub-Brush Lottie instead of `Loader2`, falling back to `Loader2` if the player fails.
- `page-skeleton` / `table-skeleton`: token-coloured shimmer blocks used by the `loading.tsx` files.

- [ ] **Step 1: Failing tests** — splash renders the tip card and `role="status"`; reduced-motion disables the animation; `BootstrapGate` keeps the splash for at least the minimum window and releases after the safety timeout even if the profile never resolves (fake timers).
- [ ] **Step 2: Run** → FAIL. **Step 3:** `npm i @lottiefiles/dotlottie-react`, implement. **Step 4:** tests + typecheck + lint green.
- [ ] **Step 5: Commit** `feat(admin-web): branded Lottie boot splash and route skeletons`

---

### Task 5: PASSWORD_CHANGE_REQUIRED / FORBIDDEN interception

**Files:**
- Modify: `src/app/providers.tsx` (QueryClient defaults), `src/components/auth/AdminAuthGate.tsx`
- Create: `src/components/feedback/permission-denied.tsx`
- Test: `src/test/auth-gate.test.tsx`

**Interfaces:**
- A shared query/mutation error handler on the `QueryClient`: on any `ApiError` with `code === "PASSWORD_CHANGE_REQUIRED"` → `router.replace("/admin/change-password")` (guard against redirect loops when already there); on `403 FORBIDDEN` → do **not** log out; let the screen render `PermissionDenied`. On a 401 that survives refresh → clear hint and replace to `/admin/login`.
- `AdminAuthGate` keeps its current structure but: uses `hasAuthHint()` instead of `getAuthState()`, renders `BrandedSplash` (not the small spinner) while the profile is first loading, sends `mustChangePassword` admins to `/admin/change-password` before any route-permission check, and renders `PermissionDenied` instead of silently redirecting when a route is disallowed but some route is.
- `PermissionDenied`: token-styled empty state with a `ShieldAlert` icon, the required permission when known, and a "Back to available area" button.

- [ ] **Step 1: Failing tests** — locked admin on `/admin/overview` is redirected to change-password; a 403 does not clear the hint; disallowed-but-authenticated renders PermissionDenied; no hint → redirect to login.
- [ ] **Step 2–4:** implement, green. **Step 5: Commit** `feat(admin-web): password-change gate and permission-denied handling`

---

### Task 6: Team page — invites, presets, bulk assignment

**Files:**
- Modify: `src/features/admin/screens/TeamPage.tsx`
- Create: `src/features/admins/components/invite-admin-dialog.tsx`, `src/features/admins/components/access-preset-select.tsx`, `src/features/admins/hooks/use-admins.ts`
- Test: `src/test/team-page.test.tsx`

**Reference:** VisiChek `src\app\(platform-admin)\admin\admins\admins-page-client.tsx` + `src\features\admins\hooks\use-admins.ts`.

**Interfaces:**
- `use-admins.ts`: `useAccessPresets()` (query `listAccessPresets`), `useInviteAdmin()`, `useResendInvite()`, `useSetAccessPreset()`, `useBulkSetAccessPreset()` — each invalidating the admins list and surfacing `sonner` toasts on success/failure.
- `invite-admin-dialog.tsx`: react-hook-form + zod (`fullName` min 1, `email` email, `accessPreset` one of the fetched keys); the preset select shows label + description; submit calls `inviteAdmin`; success toast states that a temporary password was emailed and that it expires in 72 hours.
- `access-preset-select.tsx`: shadcn `Select` over the fetched presets, used both in the dialog and per-row.
- `TeamPage`: adds an "Invite admin" button, a preset badge column, a per-row preset select, row checkboxes with a bulk-action bar ("Change preset for N selected") calling `useBulkSetAccessPreset` and reporting the `{updated, skipped}` result (skipped rows listed with their reason), and a "Resend invite" row action shown only while `mustChangePassword` is true. Guard all of it behind `canAccessAdminAction({method: "POST", path: "/api/v1/admins/invites"})` so non-privileged admins don't see dead controls.

- [ ] **Step 1: Failing tests** — invite dialog validates and posts the right body; per-row preset change posts `{preset}` to the right admin; bulk action posts `{adminIds, preset}` and renders skipped reasons; resend only appears for pending admins; controls hidden without permission.
- [ ] **Step 2–4:** implement, green. **Step 5: Commit** `feat(admin-web): admin invites and access-preset management`

---

### Task 7: Security settings — TOTP enrollment, disable, backup codes

**Files:**
- Create: `src/features/account/components/two-factor-setup-dialog.tsx`, `two-factor-disable-dialog.tsx`, `src/components/settings/security-tab.tsx`, `src/app/admin/settings/security/page.tsx`
- Modify: the admin nav definition (`src/components/AdminSidebar.tsx`) to expose the new route; `src/lib/admin-access.ts` (`ROUTE_TITLES` + `ALWAYS_ALLOWED_ADMIN_ROUTES` — security settings is self-service, so it must be always-allowed)
- Test: `src/test/two-factor.test.tsx`

**Reference:** VisiChek `src\features\account\components\two-factor-setup-dialog.tsx`, `two-factor-disable-dialog.tsx`, `src\components\settings\security-tab.tsx`.

**Interfaces:**
- Setup dialog is a stepper `init → scan → verify → backup → done`:
  - `init` explains the flow; if `profile.totpEnabled` is already true it first collects a current code (backend requires proof to re-enroll) and passes it to `setupTotp(code)`.
  - `scan` renders the `otpauthUri` as a QR plus the base32 secret with a copy button that flips to a check state, and an "enter it manually" disclosure.
  - `verify` takes a 6-digit `OtpInput` and calls `verifyTotp`.
  - `backup` shows the 8 returned codes in a monospace grid with copy-all and download-as-`.txt`, and a mandatory "I've saved these" checkbox before `done`.
  - QR: render with a tiny dependency-free SVG QR generator OR, to avoid a new dep, show the `otpauthUri` as selectable text plus an "Open in authenticator" link and the manual secret — **pick the no-new-dependency path** and note it in the report; a QR image can follow later.
- Disable dialog: warns, requires a current TOTP or backup code, calls `disableTotp(code)`, invalidates the profile.
- `security-tab.tsx`: shows 2FA state from `profile.totpEnabled` (badge), enable/disable buttons, "Regenerate backup codes" (asks for a code), and a link to change-password. Nothing here may expose secrets after the one-time reveal.

- [ ] **Step 1: Failing tests** — enable path posts setup → verify and reveals codes; re-enroll while enabled requires a code first; `TOTP_INVALID` shows mapped copy; disable posts the code; regenerate replaces the displayed set; the "saved" checkbox gates completion.
- [ ] **Step 2–4:** implement, green. **Step 5: Commit** `feat(admin-web): TOTP enrollment and security settings`

---

### Task 8: Design-system pass + Vite/react-router cleanup

**Files:**
- Modify: `tailwind.config.ts` (named z-index scale `base/sticky/dropdown/drawer/modal/popup/toast`), `src/index.css` (audit token pairs for dark mode), `src/components/AdminSidebar.tsx` (nav item `description` field surfaced in tooltips), `src/components/CommandBar.tsx` (use those descriptions as the ⌘K subtitles)
- Create: `src/components/recipes/responsive-modal.tsx`, `src/components/recipes/confirm-dialog.tsx`
- Delete: `vite.config.ts`, `index.html`, `src/legacy/vite-pages/**`, `tsconfig.app.json`/`tsconfig.node.json` if only Vite referenced them, the `react-router-dom` dependency, and the `build:dev`/`preview` scripts
- Test: `src/test/recipes.test.tsx`

**Notes:**
- Before deleting, grep for `react-router-dom`, `vite`, and `legacy/vite-pages` imports and remove/port the last consumers; `vitest.config.ts` may import `@vitejs/plugin-react-swc` — keep that dev dependency if so (Vitest needs it) and say so in the report.
- `responsive-modal`: Dialog on `md+`, `vaul` Drawer below — `vaul` is already a dependency.
- `confirm-dialog`: promise-based confirm with destructive styling, replacing ad-hoc `window.confirm`/inline AlertDialogs where they exist in touched files only.
- Dark-mode audit: walk the admin shell + login + splash + new dialogs in both themes and fix any token pair that fails contrast; list what changed.

- [ ] **Step 1:** tests for the two recipes (dialog↔drawer switch at the breakpoint; confirm resolves true/false). **Step 2–4:** implement, green — `npm run build` must also succeed after the Vite removal. **Step 5: Commit** `chore(admin-web): design-system pass and Vite cleanup`

---

### Task 9: Verification pass + login smoke test

- [ ] **Step 1:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — all green. Report any pre-existing lint debt separately from new.
- [ ] **Step 2:** Grep guarantees: no `localStorage` key holds a token (`grep -rn "accessToken\|refreshToken" src/` must only match DTO/type definitions, never storage writes); no `Authorization` header is set anywhere in `src/`; no hardcoded colour literals in files this phase created.
- [ ] **Step 3:** Playwright smoke (`e2e/admin-login.spec.ts`) against mocked API routes: `/admin/login` → credentials → OTP screen → 6-digit code → lands on an admin route with the splash having appeared. Use `page.route` to fake the API; do not require a live backend.
- [ ] **Step 4:** Write `docs/ADMIN_FRONTEND_AUTH.md`: the cookie/proxy architecture (why the Next rewrite exists and that `SameSite=Lax` depends on it), the login state machine, the auth-hint tripwire, and the deploy env vars (`API_ORIGIN`; `NEXT_PUBLIC_API_BASE_URL` is retired).
- [ ] **Step 5: Commit** `chore(admin-web): verification pass and auth architecture docs`
