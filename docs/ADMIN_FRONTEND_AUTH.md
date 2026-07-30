# Admin frontend auth architecture

How the admin console authenticates, why it is shaped this way, and what has to
be set for it to work in a deployment. The backend contract itself lives in the
API repo's `app/docs/ADMIN_AUTH.md`; this document covers only the browser side.

The one-line version: **the browser never holds a token.** The session is two
httpOnly cookies the page cannot read, and the only thing in `localStorage` is a
boolean.

---

## 1. Cookie transport and the Next rewrite

### The constraint

The backend issues the admin session as two cookies:

| Cookie          | Purpose                                    |
| --------------- | ------------------------------------------ |
| `admin_access`  | Short-lived access credential              |
| `admin_refresh` | Rotates the pair via `POST /admins/refresh` |

Both are `HttpOnly` and `SameSite=Lax`, and the backend deliberately leaves
`ADMIN_COOKIE_DOMAIN` unset.

`SameSite=Lax` is what makes the whole design safe, and it is also the whole
constraint: **a `Lax` cookie is not sent on a cross-site subresource request.**
An admin console served from `admin.example.com` calling
`https://api.example.com/api/v1/admins/profile` with `fetch(...,
{credentials: "include"})` sends no cookie at all. The request arrives
unauthenticated, the backend answers 401, and the console looks broken while
being perfectly correct.

### The fix

Make the API same-origin from the browser's point of view. `next.config.mjs`
rewrites every `/api/*` request to the real backend server-side:

```js
async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: `${process.env.API_ORIGIN ?? "https://marcus-cleaning-backend.vercel.app"}/api/:path*`,
    },
  ];
}
```

and `src/lib/api/client.ts` keeps `API_BASE_URL = ""` so every call is a
*relative* path:

```
browser ──/api/v1/admins/profile──▶ Next server ──▶ ${API_ORIGIN}/api/v1/admins/profile
        ◀── Set-Cookie: admin_access=…; HttpOnly; SameSite=Lax ───────────────┘
```

The browser only ever sees its own origin, so the cookies are first-party and
`Lax` is satisfied on every subsequent request. `credentials: "include"` is set
on every call in `apiRequest`.

### Two rules that follow from this

1. **Never point the API client at an absolute cross-origin URL.** Doing so
   silently reintroduces the `Lax` problem. `client.ts` carries a comment saying
   as much; the guard in `e2e/admin-login.spec.ts` asserts at runtime that every
   request the app makes is same-origin.
2. **Never "fix" a cookie problem by moving the backend to `SameSite=None`.**
   That trades a config change for CSRF exposure. If cookies stop arriving, the
   rewrite is misconfigured — check `API_ORIGIN`.

### What this is *not*

The rewrite is a transport detail, not an auth boundary. The Next server does no
token handling, no session storage and no credential inspection; it forwards
bytes and returns `Set-Cookie` untouched. All authorization decisions are the
backend's.

---

## 2. The login state machine

`src/hooks/use-admin-auth.ts` (`useAdminLoginFlow`) owns the state; the
component in `src/components/auth/AdminLoginForm.tsx` only renders it. That split
is why `OTP_LOCKED` can drop the user back to the credentials screen with the
lockout message still on the page without any special casing in the view.

```
                    ┌──────────────────┐
   ┌───────────────▶│  { credentials } │◀──────────────┐
   │                └────────┬─────────┘               │
   │                         │ POST /admins/login      │
   │                         │ {email, password}       │
   │                         ▼                         │
   │              otpRequired: true?                   │
   │              ┌──────────┴───────────┐             │
   │              │ yes                  │ no (legacy) │
   │              ▼                      ▼             │
   │   ┌─────────────────────┐    ┌─────────────┐      │
   │   │ { otp,              │    │completeLogin│      │
   │   │   challengeId,      │    └──────┬──────┘      │
   │   │   method,           │           │             │
   │   │   email }           │           │             │
   │   └──────────┬──────────┘           │             │
   │              │ POST /admins/verify-otp            │
   │              │ {challengeId, code}  │             │
   │              ▼                      │             │
   │   ┌──────────────────────┐          │             │
   │   │ 2xx → completeLogin ─┼──────────┤             │
   │   │ OTP_INVALID  → stay  │          │             │
   │   │ OTP_EXPIRED  → stay  │          │             │
   │   │ OTP_LOCKED   → ──────┼──────────┼─────────────┘
   │   └──────────────────────┘          │
   │   back-to-sign-in link              │
   └─────────────────────────────────────┘
                                         ▼
                              set auth hint
                              GET /admins/profile
                                         │
                       mustChangePassword ?
                    ┌────────────────────┴─────────────────┐
                    ▼                                      ▼
        /admin/change-password       resolveFirstAllowedAdminRoute(profile)
```

Details worth knowing:

- **Every admin login goes through an OTP challenge** in the normal
  configuration. The `{admin, tokens}` branch exists only for a backend running
  with `ADMIN_OTP_REQUIRED=false`; `tokens` is accepted and then ignored —
  nothing on the client reads it.
- **`method` is `"email"` or `"totp"`** and changes only the copy: a masked
  address ("We emailed a 6-digit code to `ad••n@example.com`") versus "Enter the
  code from your authenticator app". The address is masked because the OTP screen
  is reachable by anyone who can guess an email.
- **The OTP submits itself** on the sixth digit (typed, pasted, or filled from an
  SMS/keychain suggestion), and the field is cleared afterwards whatever the
  outcome, so a burnt code never lingers on screen.
- **The challenge step grants nothing.** The auth hint is written only after
  `verify-otp` returns 2xx.
- **`OTP_LOCKED` returns to credentials by design.** The challenge is burnt after
  5 attempts, so only a fresh login can issue a new one; leaving the user on a
  dead code field would be a trap.
- **Error copy is centralised** in `src/lib/api/auth-errors.ts`, keyed on the
  backend's `data.code`. `INVALID_CREDENTIALS` takes a `context` argument because
  the backend reuses that code for "wrong password" on the change-password screen,
  where the login wording ("that email and password…") would be a non-sequitur.

### Session refresh

`apiRequest` retries once on a 401/403: it calls `POST /admins/refresh` with no
body (the refresh cookie is the credential), and replays the original request if
that succeeds. The refresh is single-flight — a `refreshPromise` module global —
so a screen firing six queries at once produces one refresh, not six. A failed
refresh clears the auth hint, which is what turns a dead session into a
navigation back to `/admin/login`.

---

## 3. The auth-hint tripwire

`src/lib/api/auth-storage.ts` is the entire client-side session store:

```ts
export const AUTH_HINT_KEY = "admin_auth_hint_v1";
export function hasAuthHint(): boolean;   // localStorage[key] === "1"
export function setAuthHint(): void;
export function clearAuthHint(): void;
```

**Why it exists.** The real session is httpOnly, so the page has no synchronous
way to ask "am I logged in?" — the only authority is `GET /admins/profile`, which
is async. Without a synchronous signal, every first paint would have to assume
the worst and flash a login screen at an authenticated admin, or assume the best
and flash a half-built console at an anonymous visitor.

**What it is.** One bit meaning *"the last thing this browser knew, login had
completed."* It is not a credential, it is not proof of anything, and nothing is
authorized on the strength of it. It decides which of two loading surfaces to
paint while the profile query resolves:

| Reader                                        | Uses the hint to…                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `BootstrapGate` (`src/app/providers.tsx`)     | hold the branded splash over a cold boot instead of flashing the console  |
| `AdminAuthGate` (`src/components/auth/`)      | redirect to `/admin/login` immediately when absent                        |
| `useAdminProfile`                             | `enabled:` — don't fire a profile request that is certain to 401          |
| `/admin/change-password`                      | same guard, outside the permission-checked shell                          |

**Who clears it.** `client.ts` on a 401 or `AUTH_ROLE_MISMATCH`, on a failed
refresh, and `useAdminLogout`. A stale hint is therefore self-healing: the first
request 401s, the hint is cleared, the query-cache error handler navigates to
login.

**Invariants.** No token, of any kind, is ever written to `localStorage` or
`sessionStorage`. `accessToken`/`refreshToken` appear in `src/` exactly twice —
as fields of the `TokenResponse` interface in `src/lib/api/types.ts` — and no
`Authorization` header is set anywhere in the client. Both properties are
asserted, not just documented: by `src/test/api-client.test.ts` and again against
a real browser in `e2e/admin-login.spec.ts`.

---

## 4. The `mustChangePassword` gate

Invited admins receive a temporary password. Until they replace it, the backend
answers **403 `PASSWORD_CHANGE_REQUIRED`** on *every* permissioned admin
endpoint — not just the profile. The client therefore blocks in two places:

1. **Proactively.** `AdminAuthGate` reads `profile.mustChangePassword` and
   redirects to `/admin/change-password`. This check runs *before* the route
   permission check, so an admin on a locked temporary password always lands on
   the change-password screen rather than on a `PermissionDenied` page for
   whatever route they happened to open.
2. **Reactively.** `handleAdminQueryError` in `src/app/providers.tsx` catches
   `PASSWORD_CHANGE_REQUIRED` from any query or mutation and redirects, guarded
   against firing while already on `/admin/change-password`.

`/admin/change-password` is listed in `BARE_ADMIN_ROUTES`
(`src/app/admin/layout.tsx`) and renders outside `AdminAuthGate` and the admin
shell. It has to: no route permission requirement could be satisfied while every
permissioned endpoint is returning 403. It still requires the auth hint — there
is no password to change without a session.

On success the profile is force-refetched so `mustChangePassword` flips false
everywhere it is read. That refetch is deliberately wrapped in its own
`try/catch`: the password change is irreversible by the time it resolves, so a
network blip on the follow-up profile GET must not be reported to the user as a
failed submission.

---

## 5. Deploy environment variables

| Variable                               | Where        | Required | Purpose                                                             |
| -------------------------------------- | ------------ | -------- | ------------------------------------------------------------------- |
| `API_ORIGIN`                           | server only  | yes¹     | Rewrite target — the backend's scheme + host, **no** trailing `/api` |
| `NEXT_PUBLIC_AUTH0_RESET_PASSWORD_URL` | public       | no       | Renders the "Forgot password?" link; the link is hidden when unset   |

¹ Defaults to `https://marcus-cleaning-backend.vercel.app` when unset, which is
correct for production and wrong for anything else. Set it explicitly per
environment.

```sh
# .env.local
API_ORIGIN=http://localhost:8000
```

### `NEXT_PUBLIC_API_BASE_URL` is retired

Do not reintroduce it. It was the bearer-token era's "call the API directly"
switch, and any value it holds now is either ignored or actively harmful:

- It was `NEXT_PUBLIC_*`, i.e. inlined into the client bundle, which is exactly
  the cross-origin absolute URL that breaks `SameSite=Lax` (§1).
- The client's base URL is a compile-time constant `""` and is not configurable
  by design.

The server-side `API_ORIGIN` replaces it. Nothing in `src/` reads
`NEXT_PUBLIC_API_BASE_URL`.

### Related backend settings

Two backend settings are load-bearing for this design and are called out here
because breaking them looks like a frontend bug:

- `ADMIN_COOKIE_DOMAIN` must stay **unset**, so cookies are host-only on the
  Next origin.
- Admin cookies must stay `SameSite=Lax` + `HttpOnly`. See §1 for why `None` is
  not an acceptable workaround.

---

## 6. Verifying it end to end

```sh
npm test                                  # unit + component
npx tsc --noEmit
npm run lint
npm run build

npx playwright test                       # e2e/admin-login.spec.ts
PLAYWRIGHT_CHANNEL=chrome npx playwright test   # use a system browser instead of Playwright's
```

`e2e/admin-login.spec.ts` drives the real login screen in a real browser against
`page.route` stubs — no backend and no `API_ORIGIN` needed — and asserts the
architecture, not just the happy path: same-origin requests only, no
`Authorization` header on anything, `admin_access`/`admin_refresh` present and
`HttpOnly`+`Lax`, invisible to `document.cookie`, and nothing but the hint in
`localStorage`.
