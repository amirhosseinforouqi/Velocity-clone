# SYSTEM_AUDIT.md — Keyway (interim, audit in progress)

Status: **interim draft, 2026-11-13.** The audit stopped part-way through step 2 (feature inventory). Nothing in
the application has been changed yet. Items marked "Not yet verified" have not been exercised.

Environment: local dev server, local PGlite database, synthetic data only, signed in as the seeded agent.
Baseline: lint 0 errors, typecheck 0 errors, `npm test` 79/79 passing, `next build` succeeds.
`npm audit`: 28 advisories (2 critical, 7 high), mostly transitive through the `shadcn` CLI listed in `dependencies`.

## Verified functional (exercised live)

| Feature | Evidence |
|---|---|
| Staff sign-in | Signed in as seeded agent; session reloaded from DB per request |
| Create application (Add → Application) | Created synthetic deal KW-100133; required-field validation fires |
| Deal workspace save + persistence | Subject property, mortgage, borrower, employment fields saved and survived reload |
| Calculations | LTV 80.00% (480,000 / 600,000), qualifying rate 6.79%, GDS/TDS 48.12% match hand calculation |
| Conditions + smart rules | 5 conditions auto-added on save |
| Document upload / download | PDF accepted, status → "received" (not auto-accepted); download is `attachment`, `nosniff`, `no-store`; HTML renamed `.pdf` rejected |
| Pipeline move | Move to Submitted updates status, submitted date, and dashboard column |
| Deal tasks → My Day | Task added on the deal appears on My Day with deal number and borrower |
| Role gating of routes | Agent gets 404 on every `/admin/*` page and `/compliance/dashboard`; cron endpoint 401 |
| Report builder / CSV export | Columns are a fixed whitelist; SIN is not selectable |
| Print application | SIN masked to last 3 digits |

## Frontend-only placeholders (look real, save nothing)

| Screen | Problem |
|---|---|
| `/user/settings`, `/user/profile`, `/account/settings/compliance` | Show "Your changes have been saved." without saving; fake "Google Connected" |
| `/tools/importer` | Fabricates import results |
| `/contacts/merge` | No merge happens (only duplicate lookup exists server-side) |
| `/deals/historical`, `/deals/historical/restore` | Local state only |
| `/messages`, `/deals/new-applications`, support domain / webhook pages | Empty placeholders |
| Home "Message Centre" / "CRM Overview", top-bar New-applications bell | Placeholder data |
| Add Contact / Lead / Application modals | Agent, Contact Preference, Marital Status, DOB, Language, Activity Type, Notes, Reference # are silently dropped |

## Partially implemented / missing backend

- Deal notes, pinned notes, email history, document submission history, lenders table, co-broker, commissions: no storage.
- Only one applicant's detail fields per deal although multiple borrowers are supported in the data model.
- Lender submission: correctly disabled ("Not built yet"); "Submitted" is a manual tracking status only.
- No stage gating on status moves (validation is advisory).
- TDS excludes non-property liabilities (no liabilities table); MQR floor and ratio limits are hard-coded.

## Duplicated / inconsistent

- Two document systems: legacy staff conditions (`documents`) and portal (`files` / `document_requests`).
- `velocity-website-clone/` is an older prototype superseded by this app (left untouched).
- Contact screen says SIN "is not stored" pending encryption, while the deal workspace stores it in plaintext.

## Navigation / UX defects

- Admin menu and Compliance / No-Agent report links are shown to roles that get 404.
- Hard-coded `Access: DEMO0001`; "Previous Deals" menu always empty; Help link is `mailto:support@example.com`.
- Money formatting drops the trailing zero ("$2,734.6"); three date inputs in the deal overview have no label.

## Critical defect (P0)

- **SIN stored in plaintext** in `deals.fields`, shown unmasked in a text input, and copied into `audit_log`
  before/after values by `saveDeal`, `createDeal`, and `duplicateDeal`.

## Not yet verified

Admin pages as org admin (users, lenders, logs, recently deleted, compliance dashboard), cross-user access
boundaries exercised live (second agent, other office, portal client), client portal invite/upload/review,
contacts list/detail, search, calendar, lender management, approval/closing, failure recovery, returning user.
