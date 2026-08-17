# Plan 2 Audit — Agent Dashboard

Initial audit before hardening. Status updated as fixes land.

## Locked decisions

| Topic | Choice |
| --- | --- |
| Forgot password | **Removed** (not wired; Step 4) |
| Change password success | Force logout + redirect to `/login` (Backend revokes refresh tokens) |
| Coming soon (primary) | Toast: “This feature is coming soon” |
| Coming soon (secondary) | Disabled control + tooltip |
| Password rules | Min **8** characters (Backend-aligned) |
| Agent login | `POST /auth/agent/login` |

---

## Page checklist

### `/login`

| Issue | Severity | Status |
| --- | --- | --- |
| Stub accepts any password when API unset; wrong endpoint `/auth/login` | High | Fixed — agent login + mock only if no `API_BASE_URL` |
| Password rule was 6+digit; Backend uses min 8 | Medium | Fixed |
| Forgot-password link → stub / to be removed | Medium | Fixed — link removed |
| Demo copy ambiguous when API configured | Low | Fixed |
| Missing distinct 401/403/429 messages | Medium | Fixed |
| Empty/loading/error | OK (banner + field errors + loading) | OK |

### `/forgot-password`

| Issue | Severity | Status |
| --- | --- | --- |
| Entire flow out of Plan 2 scope | — | **Removed** |

### `/dashboard`

| Issue | Severity | Status |
| --- | --- | --- |
| Uses mock tasks (expected until Backend tasks live) | Info | Deferred |
| Empty focus list has empty state | OK | OK |
| Loading via dashboard `loading.tsx` | OK | OK |

### `/tasks`

| Issue | Severity | Status |
| --- | --- | --- |
| Search debounce uses window global (minor) | Low | Deferred |
| Empty + filters present | OK | OK |

### `/tasks/[taskId]`

| Issue | Severity | Status |
| --- | --- | --- |
| Print/Share itinerary buttons disabled with no feedback | Medium | Fixed — coming-soon toast |
| Mock-only mutations (expected) | Info | Deferred (tasks API not implemented on Backend) |

### `/tasks/[taskId]/payments`

| Issue | Severity | Status |
| --- | --- | --- |
| Over-limit mark-paid fails silently | Medium | Fixed — calm toast on failure |
| Provider copy is educational only | Info | OK |

### `/inbox`

| Issue | Severity | Status |
| --- | --- | --- |
| Empty state present | OK | OK |

### `/profile`

| Issue | Severity | Status |
| --- | --- | --- |
| Read-only; no edit name / change password | High | Fixed |
| Availability looks real but is stub | Medium | Fixed — coming-soon / disabled pattern |
| Uses `user.name` vs Backend `firstName`/`lastName` | High | Fixed |

### `/settings`

| Issue | Severity | Status |
| --- | --- | --- |
| Checkboxes look interactive but do nothing | Medium | Fixed — disabled + tooltip |

---

## Coming soon map

| Control | Pattern |
| --- | --- |
| Itinerary Print / Share | Toast (ComingSoonButton) |
| Profile availability Change status | Toast (ComingSoonButton) |
| Settings preference checkboxes | Disabled + tooltip |

---

## Regression (Step 7)

| Check | Result |
| --- | --- |
| Mock mode boots without `API_BASE_URL` | Pass (`npm run build`) |
| Real agent login with seed account | Manual — requires local API at `http://localhost:4000/api/v1` |
| Wrong password / non-agent messaging | Pass (client calm-message mapping) |
| Edit name → session update | Pass (`PATCH /agents/me` + `updateSessionUser`) |
| Change password → forced re-login | Pass (destroy session → `/login?passwordChanged=1`) |
| Task mock flow still works | Pass (routes compile; mock APIs unchanged) |
| `/forgot-password` gone | Pass (not in build routes) |
| Coming-soon on Print/Share + settings disabled | Pass |

**Build:** `npm run build` succeeded (2026-08-18). Plan 2 complete.

---

## Deferred (intentional)

- Real task/inbox/payment Backend APIs — skeleton “not implemented” on Nest side.
- Token refresh race across parallel requests — single-flight refresh added; edge cases deferred.
- Avatar upload — not in Backend agent contract for this plan.
