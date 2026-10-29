# Implementation plan

This plan turns the front-end reference build into a working mortgage platform. It is based on [platform-gap-analysis.md](platform-gap-analysis.md).

## Decisions needed before Phase 5 starts

Each one has a default if you have no preference:

| Decision | Default proposal |
|---|---|
| Product name and logo (replaces Velocity branding) | You choose; a placeholder name until then |
| Database / ORM | PostgreSQL + Drizzle ORM (SQL-first migrations, light runtime) |
| Auth | Auth.js (credentials + email magic link) with TOTP MFA for admins |
| File storage | S3-compatible (AWS S3 or Cloudflare R2), private bucket, signed URLs |
| Email / SMS | Pending until you have accounts (Resend or Postmark; Twilio) |
| Hosting | Vercel for the app + a managed Postgres (Neon or Supabase) |
| Data residency | Canada region, if the client data has to stay in Canada (likely, for Canadian borrowers) |

## Architecture

- **Next.js App Router throughout:**
  - Server Actions and route handlers form the API
  - The existing components keep their look and get their data from server components
- **Tenancy:**
  - `organization → office → user`
  - Every business table carries `organization_id`, and a deal also carries `office_id`
  - One data-access module applies the scope. No query reaches the DB without it.
- **Permissions:**
  - Roles: `org_admin`, `office_admin`, `agent`, `assistant`, `support`
  - A single `can(user, action, resource)` function is checked in every server action
  - Agents see only their own deals plus deals they assist on; office admins see their office
- **Audit:**
  - The `audit_log` table is append-only: actor, tenant, entity, entity id, action, before/after diff, IP, time
  - It is written in the same transaction as the change
  - The Logs screen reads it
- **Documents:**
  - Uploads go to a private bucket, with a checked type and size limit
  - Downloads use short-lived signed URLs after a permission check
  - A virus scan is a pending integration
- **Deletes:** soft delete (`deleted_at`) for deals and contacts, matching the reference's no-delete policy; hard delete only for admin-configured lookups.
- **Integrations** sit behind small adapters, for example `creditBureau.pull()`, with a `pending` adapter. The pending adapter returns a clear "Integration not configured" error and the UI shows a **Pending integration** badge. It never fakes a success.

## Core tables (first migration)

- **Tenancy and people:** organizations, offices, users, user_offices (role), sessions
- **Contacts:** contacts, contact_consents (CASL log), contact_merges
- **Deals:**
  - deals (status, stage dates, agent_id, office_id)
  - deal_borrowers (deal ↔ contact, role, order)
  - properties, assets, liabilities, incomes, mortgage_requests, insurance, referrals
  - deal_status_history
- **Work and documents:** conditions, condition_templates, documents, notes, tasks, calendar_events
- **Lenders:** lenders, lender_products, underwriters
- **Platform:** audit_log, webhooks, webhook_deliveries, consent_templates

## Build order

Each step ships working, tested and documented before the next one starts:

1. **Rebrand + git init.** New name and logo; remove the reference logo and links.
2. **Foundation.** DB, migrations, seed script with synthetic data, auth, tenancy scope, `can()`, audit log.
   - Test: the isolation test (office A can't read office B) and a role test.
3. **Contacts.** CRUD, CASL consent log, soft delete, merge.
4. **Deals core.** Create (lead / quick app), workspace sections persisted, status state machine with history, park / cancel / reinstate, card and grid dashboards from SQL.
5. **Validation and metrics.** Save + Validate rules; GDS / TDS / LTV functions with unit tests.
6. **Conditions and documents.** Checklist, templates, smart rules (by purpose / type), secure upload and download.
7. **Tasks.** My Day, reminders, calendar.
8. **Reports.** Production, pipeline, SLA, no agent; CSV export; the report builder over a field whitelist.
9. **Admin.** Offices, users, roles, organization toggles, lenders and products, consent templates, logs from the audit table.
10. **Compliance.** Per-deal compliance status, package lock, AML risk questionnaire.
11. **Client Experience.** Tokenised client application and portal, limited to upload-only access for the client.
12. **Outbound.**
    - Webhooks with signing and a retry log
    - Email / SMS / eSign / credit / lender adapters: each one stays **pending** until you supply credentials

## Progress

Updated 2026-10-28.

- **Step 1, rebrand:** Done.
  - The placeholder name is "Keyway".
  - The reference logo, name and links are gone.
  - git is initialised, with nothing committed.
- **Step 2, foundation:** Mostly done.
  - **Built:**
    - Drizzle schema and migration (`src/server/schema.ts`, `drizzle/`)
    - dev seed with synthetic users and contacts
    - Auth.js credentials sign-in with 8h JWT sessions
    - `proxy.ts` route protection
    - `contactScope()` tenancy
    - `audit_log`
  - **Locally:** Postgres runs as PGlite, because no server is installed. Swapping to hosted Postgres is a driver change in `db.ts`, still untested.
  - **Pending:**
    - a general `can()` (only the contact rules exist so far)
    - magic link and TOTP MFA
    - a shared lockout store
    - copying `drizzle/` into the standalone build
- **Step 3, contacts:**
  - **Done and tested:** CRUD, the CASL consent log, soft delete.
  - **Pending:**
    - merge
    - the extra profile fields
    - server-side search
- **Step 4, deals core:**
  - **Done and tested** (server tests plus a click-through as the seeded agent):
    - deals, deal borrowers and status history tables, with `dealScope()` tenancy
    - create a lead, an application (new contact + deal) or a quick application from a contact
    - workspace sections saved to the deal; only known field keys are accepted, and every save is audited
    - the status state machine (`src/server/deal-status.ts`): park, cancel and reinstate to the previous status, a history row and an audit row per move, assistants can't cancel
    - card and grid dashboards and the Parked list read from SQL, scoped to the user
    - `/deal?loanCode=KW-…` lookup; a deal outside the user's scope is a 404
  - **Pending:**
    - workspace tables (notes, conditions, reminders, tasks, co-borrowers) have no storage; their buttons are disabled
    - reassigning the agent; the Unassigned / No Agent grid filters are always empty because every deal has an agent
    - the "Previous Deals" menu still shows placeholder data
    - deal links from calendar, inbox, My Day and reports still point at placeholder deals and fall back to the dashboard
    - the "As:" selects are placeholders
    - SIN is stored in the deal JSON without field-level encryption; it needs encryption before real data
    - Add Lead / Add Application create the contact and the deal in two transactions
- **Step 5, validation and metrics:**
  - **Done and tested** (unit tests plus a click-through as the seeded agent on a synthetic deal):
    - `src/server/metrics.ts`: GDS, TDS and LTV from the saved deal fields. Payments compound semi-annually; the qualifying rate is the entered one or the greater of contract + 2% and 5.25%; LTV uses the lower of price and appraisal; half the condo fees count unless "@100%" is Yes; income is annualised by Income Period
    - `src/server/validate.ts`: Save + Validate saves first, then checks required fields (skipped for leads), formats (numbers, rates, postal code, SIN checksum, past dates, year built) and the limits (GDS 39%, TDS 44%, LTV 95%, insurer required over 80%; since the lenders step, the deal's lender can set its own GDS/TDS/LTV, and its LTV also caps the uninsured threshold)
    - the deal header shows the three ratios, a TDS breakdown, and an error list where each error opens and focuses its field
    - fixed in passing: saving reset the deal form, which blanked saved select fields (purpose, province, amortization) on the next save; the form now submits without the automatic reset
  - **Pending:**
    - TDS only counts other-property payments and expenses; it needs a liabilities table (cards, loans)
    - no rental income offset; only the first applicant's income fields exist
    - validation is advisory and blocks nothing (no lender submission yet)
    - the 5.25% floor and the ratio limits are hard-coded; lender-specific limits come with lender products (step 9)
    - the reference's rules and formulas weren't visible, so these are our own
    - clicking an error for a field on another tab does nothing
- **Step 6, conditions and documents:**
  - **Done and tested** (server tests plus a click-through as the seeded agent on a synthetic deal with synthetic files):
    - tables `condition_templates` (the library, with a smart rule), `deal_conditions` and `documents` (migration `0002_conditions`)
    - smart rules (`src/server/conditions.ts`): a rule lists accepted values per workspace field and all must match; an empty rule applies to every application. Rules run in the same transaction as create, save and status change; leads are skipped; a condition is never added twice, and a waived one never comes back
    - a starter library of 12 conditions in our own wording, keyed on purpose, employment type and tenure
    - the Conditions & Documents tab: add from the library or a custom condition, set the status, upload, download, remove
    - uploads: PDF, JPEG or PNG decided by the file's first bytes (not its name), 10 MB limit, file name cleaned, an outstanding condition becomes received
    - downloads go through `/api/documents/[id]` only: signed in, deal in scope, audited, sent as an attachment with `nosniff` and no caching; an unknown or out-of-scope id is a 404
    - remove is a soft delete; the file is kept for the audit trail
    - fixed in passing: the standalone build copied the local `.data` folder (the dev database, and now uploads) into its output; `.data` is now excluded from file tracing
  - **Pending:**
    - files are on local disk (`.data/uploads`, or `UPLOAD_DIR`), outside the web root but **not encrypted**. S3 / R2 with encryption at rest and short-lived signed URLs needs a bucket and credentials; only `src/server/storage.ts` and the download route change
    - **no virus scan** (pending integration); it has to exist before clients can upload (step 11)
    - no screen to edit the library or its rules (step 9, admin); rules only match exact field values
    - no condition groups, bundles or lender-specific conditions; no PDF conversion
    - "Lender Conditions Met" is still a plain checkbox, not derived from the checklist
    - the Document Submission History and Emails tables are still empty placeholders (the Compliance table is filled since step 10)
- **Step 7, tasks:**
  - **Done and tested** (server tests plus a click-through as the seeded agent on a synthetic deal with synthetic tasks):
    - a `tasks` table (migration `0003_tasks`): type (phone, SMS, email, follow-up, appointment, personal, other), title, due date, optional time, notes, assignee, optional deal, done time, soft delete; every change is audited with only the changed fields
    - who sees what (`src/server/tasks.ts`): a task without a deal is private to its creator and can't be assigned to anyone else; a deal task can be assigned to anyone who can open the deal, and everyone who can open the deal sees it. Borrower details are joined only when the deal is in the viewer's scope
    - My Day: your tasks for a day, plus your open overdue ones on today; phone, SMS, email and other lists; done / to do, postpone (moves past today), remove, and the same three as bulk actions; day navigation by URL
    - the calendar: month, week and day views read from the URL and load only the days shown; drag to add, drag to move (an hour sets the time), and an edit modal with all day, date, time, title, description, done and delete
    - deal reminders: derived, not stored. An active deal is Urgent within 2 days of its closing or conditions date (or past it), a Warning within 7, a Notice within 14; the conditions date stops counting once Lender Conditions Met is ticked. The reminders page and the top bar bell use them
    - the deal's Reminders & Tasks tab: reminders are follow-up tasks, the other table holds the rest; add, done, reassign and remove inline
    - the top bar's tasks and reminders badges are real
  - **Pending:**
    - **SMS and email are not sent.** Those My Day lists say "Pending integration"; you send the message yourself and mark the task done
    - **Google Calendar sync is not connected.** The Connect button is disabled and marked "Pending integration"
    - the reminder thresholds are fixed; they become an organization setting in step 9
    - the time zone is one setting for the whole app (`TIME_ZONE`, default America/Toronto), not per user
    - the top bar badges refresh when you change page, not right after a change on the same page
    - no recurring tasks, end times, locations, or reassigning from My Day
    - a new migration needs a dev server restart; migrations run once when the server opens the database
- **Step 8, reports:**
  - **Done and tested** (7 server tests, 39 in all, plus a click-through as the seeded agent on synthetic deals):
    - every report is a SQL query over the deals the user can see (`dealScope`), in `src/server/reports.ts`; filters live in the URL, so the page, a reload and the CSV show the same report
    - Production: deals that entered each status this week (from Sunday), month and year, with units and dollars, from the status history; "Funded by Lender" counts funded deals per lender; drilldown to the deals
    - Pipeline: deals by closing month for a year (leads, parked, cancelled and declined left out), with a month drilldown
    - SLA: one row per agent, deals within or over the target days in Approved (7), Accepted (7) and Waiting to Close (30), counted from when the deal entered its current status; drilldown shows the days
    - office and agent filters only list what the user's scope contains; an id outside the scope matches nothing
    - report builder: columns and filters come from a fixed whitelist of 12 fields, operators from a fixed list per field type, every value is a bound parameter (`contains` escapes `%` and `_`), at most 10 filters of 200 characters; anything else is rejected with a message
    - one-touch: Deals - All, Deals - Entry Date, Deals - Closing Date and Leads, over a date range
    - CSV export at `/reports/<slug>/export` with the page's query: signed in, scoped, sent as an attachment with `nosniff` and no caching; cells a spreadsheet would run as a formula are prefixed with `'`; every export is audited with the report, query and row count
    - the placeholder report data is gone from the report pages
  - **Pending:**
    - **Credit Bureau** report: no credit pulls exist yet (pending integration). **Borrower Risk** and **Sanction Screening**: no AML data yet (step 10). The pages say so and show no numbers
    - **No Agent Assigned**: every deal has an agent today; it becomes useful once step 9 can deactivate users and reassign their deals
    - one-touch Birthdays, Anniversaries, Maturities, Rate Expiries and Contacts need contact fields that aren't stored yet; marked Pending
    - saved builder reports are kept in the browser only (`localStorage`), not per user on the server
    - reports load at most 5,000 deals and total them in JS; move the grouping into SQL when an organization gets bigger. The page says when the cap is hit
    - SLA targets are fixed; they become an organization setting in step 9
- **Step 9, admin:**
  - **Done and tested** (7 server tests, 46 in all, plus a click-through as the seeded org admin and office admin with synthetic records):
    - migration `0004_admin`: `consent_templates`, plus `details` on offices and users, `settings` on organizations and `deactivated_at` on users
    - every admin page is a server page behind `adminPage()` (`src/app/admin/guard.ts`): org admins see everything; office admins see only their own office and its non-org-admin users, and get a 404 on organization settings, the office list, new offices, the condition library and logs
    - offices: create, edit and delete; details are whitelisted fields; an office that still has users or deals can't be deleted
    - users: create, edit, User Matrix (inline role and office); passwords of 12+ characters, unique emails, no changing your own role, an office admin can't grant org admin or hire into another office; the audit log records "password changed", never the hash
    - deactivate and restore: a deactivated user can't sign in and their open session stops on its next request; their deals and tasks move to an active user in the same office, or the deals show under No Agent until someone takes them
    - organization settings: name, SLA target days per status (used by the SLA report), reminder thresholds (urgent < warning < notice, used by reminders and the bell) and feature toggles
    - consent templates per office in English and French, with acceptance, signature and page-break options
    - condition library editor: rules may only name real workspace fields (a datalist offers them); values are trimmed and de-duplicated
    - logs: the audit table, filtered by entity, 25 a page, with a before/after view
    - fixed in passing: collapsed sections unmounted their fields, so saving a form wiped what was inside them, and their header button submitted the form; a validation error cleared the admin forms' typed inputs (React 19 resets a form after its action), so the admin forms now submit without the reset
  - **Pending:**
    - feature toggles are saved but no feature checks them yet
    - a user's working provinces and associates aren't stored; the user and office forms keep only whitelisted fields
    - the consent PDF is a layout preview, not a generated document
    - the admin nav is still shown to agents and assistants (the pages 404 for them)
    - a new user's office defaults to the first office alphabetically, not the admin's own
    - Add Lead / Add Application and the contact profile still post with `<form action>`, so a validation error may clear their inputs; not checked
    - reassignment on deactivate is same-office only
    - the No Agent grid filter is covered by a server test, not clicked through
    - the dev database (`.data/pglite`) was corrupted when the dev server was hard-stopped and is now at `.data/pglite-broken-2026-10-28`; a fresh one was seeded. Stop the dev server normally
- **Lenders and products** (deferred from step 9):
  - **Done and tested** (4 new tests, 50 in all, plus a click-through as the seeded org admin, office admin and an agent with synthetic lenders):
    - migration `0005_lenders`: `lenders` (type, code, group, underwriters, fees, ratio limits, submission agents, hidden) and `lender_products` (term and fees); four synthetic starter lenders are seeded, one hidden
    - Lenders list (search, add, remove = hide, show removed, unhide), Lender Matrix and the lender page (details, underwriters with a default, fees and days, Max GDS/TDS/LTV, submission agents, products added, edited and deleted in place); org admins only, everyone else gets a 404; every change is audited
    - deals: the Lender and Product selects offer only active lenders the deal's agent may submit to, grouped by lender group; a saved value that's no longer offered stays shown. Add Application's lender list follows the same rule
    - Save + Validate flags a lender the agent can't use and a product that isn't the lender's, and uses the lender's own limits; the deal header colours ratios against them
  - **Pending:**
    - an unknown lender doesn't block saving or Add Application; validation only advises
    - lender-specific conditions
    - commission fields aren't calculated from the lender and product fees
    - deals store the lender and product by name, so renaming a lender leaves old deals on the old name
    - the seeded placeholder deals use the product name "5 Yr Fixed", which no seeded lender offers, so Save + Validate flags it (on purpose: it shows the check)
- **Step 10, compliance:**
  - **Done and tested** (6 new tests, 56 in all, plus a click-through as a seeded agent on a seeded synthetic deal: the AML form's validation, saving an assessment, the risk shown on the deal, both AML reports, and the dashboard returning 404 for an agent):
    - migration `0006_compliance`: a compliance status (In progress, Non-compliant, Compliant) and package lock time on deals, `compliance_reviews` (an append-only history of status, note and lock) and `aml_assessments` (one per borrower per deal)
    - the deal's Compliance panel: status, package, review history and an AML Risk Assessment per borrower. Organization and office admins get Manage Compliance (status, note, Lock package); anyone who can see the deal can fill in the questionnaire
    - rules: Non-compliant needs a note; Compliant needs every borrower assessed and screened; only a Compliant package can be locked; changing an assessment on a Compliant deal sets it back to In progress with a review note
    - a locked package freezes the deal's conditions, documents (downloads still work), smart rules and AML answers until a reviewer unlocks it
    - AML risk (Low, Medium, High) is worked out from seven questions in Keyway's own wording; a possible sanction-list match is always High. The questions are not legal advice and need review against the organization's compliance program
    - Compliance dashboard (Admin > Compliance, admins only): search by agent, borrower or loan code, filter by deal status and compliance status, Manage Compliance from each row; scoped like the deals grid; audited changes
    - Borrower Risk Assessment and Borrower Sanction Screening reports, filterable by office and agent (the per-agent variant)
  - **Not verified in the browser:** the admin side (the dashboard page, the Manage Compliance modal, locking and the locked checklist). Signing in as the seeded admin from the browser was blocked by the session's permission check; the server rules behind them are covered by the tests
  - **Pending:**
    - sanction screening is a manual record; automated list screening needs a provider (integration) and is not connected
    - no override of the computed risk
    - a lock doesn't stop edits to the deal's own fields
    - Compliance Settings (Me) and office AML settings are still placeholders; Compliance Package Logs (admin logs) is still a placeholder
    - the dashboard shows at most 500 deals, with no paging
- **Next:** step 11, Client Experience.

## Testing

- `npm test` runs the `node:test` suites (`src/server/*.test.ts`): the server, conditions and tasks tests against an in-memory PGlite with the real migrations, and the metrics and validation unit tests. There are 56 tests and all pass.
- `npm run check` runs lint, typecheck, the tests and the build.

- **Unit tests** (Node's built-in `node:test`, no new framework): the metrics, the status machine, `can()`, validation.
- **Integration tests** against a throwaway Postgres: tenancy isolation, audit rows written, soft delete.
- **UI:** a click-through in the preview browser for each feature.
- **Every run:** `npm run check` (lint, typecheck, build).
- **Docs:** the coverage and gap docs are updated after each step. A feature becomes "Done" only after its tests pass.

## Rules carried forward

- Synthetic data only; no real client data anywhere in the repo, logs or fixtures.
- No integration is shown as working without real credentials and a passing test.
- The reference app stays read-only; anything that would change it needs your explicit approval first.
