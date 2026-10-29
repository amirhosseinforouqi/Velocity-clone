# Platform gap analysis

This compares the reference features ([velocity-feature-inventory.md](velocity-feature-inventory.md)) with this project as it stands.

## The project today

Updated 2026-10-27, after Phase 5 steps 1–6:

- **Stack:**
  - Next.js 16, React 19, Tailwind v4
  - Postgres via Drizzle ORM. Locally this runs as PGlite (Postgres in-process, data in `.data/pglite`), because no Postgres server is installed here.
  - Auth.js credentials sign-in
- **Size:** 37 routes; the UI lives in `src/components/platform/`, the backend in `src/server/`.
- **Backend so far:**
  - organizations, offices, users, contacts, contact consents, deals, deal borrowers, deal status history and the audit log, created by a generated migration (`drizzle/`)
  - sign-in, route protection and the tenancy scope
  - contacts and deals read and written through the DB
- **Everything else** is still the front-end reference build: synthetic data from `placeholder-data.ts`, held in React state.
- **Branding:** placeholder name "Keyway" with its own icon. The Velocity logo, name and links have been removed from the UI.
- **Git:** initialised, nothing committed.

## Status key

- **Done**: Already implemented and verified.
- **Improve**: Exists but needs improvement.
- **Missing**: Missing.
- **External**: Requires an external integration.
- **Unknown**: Unknown or blocked.

"Done (UI)" means the UI was built and click-tested with synthetic data only. A plain "Done" means the feature is stored in the database, covered by tests and click-tested.

| Feature | Status | What's there / what's needed |
|---|---|---|
| App shell, navigation, menus, responsive layout | Done (UI) | Rebranded to the placeholder "Keyway"; colours still match the reference |
| Deals dashboard card and grid | Done | Read from SQL and scoped to the user. **Pending:** server-side filters and paging. The No Agent filter shows deals whose agent was deactivated without a reassignee (step 9) |
| Deal workspace, 8 tabs | Improve | **Done:** section fields save to the deal (whitelisted keys, audited); applicant fields mirror the contact. Reminders & Tasks tab is **Done** (step 7). **Pending:** tables (notes, co-borrowers), field-level encryption for SIN |
| Deal statuses and transitions | Done | State machine with allowed moves, a history row and an audit row per move, park/cancel/reinstate; deals are never deleted |
| Save + Validate | Done | Saves, then runs our own server-side rules (the reference rules are unknown): required fields, formats, ratio limits. Errors focus their field. Checks the deal's lender and product against the lenders the agent may use (lenders step). **Still missing:** blocking submission on errors, lender-specific conditions. |
| GDS / TDS / LTV metrics | Done | Pure functions with unit tests, shown in the deal header with a TDS breakdown. **Still missing:** a liabilities table for full TDS, rental income offset, more than one applicant's income. Limits are per lender since the lenders step (blank uses the defaults) |
| Add lead / contact / quick application | Improve | **Add Contact is Done:** it saves to the DB with server validation and a live duplicate check. Add Lead, Add Application and Quick Application now create deals too (tested). |
| Client Experience (online application and portal invite) | Missing | Needs a client-facing form, tokenised invite links, an email provider (External) |
| Conditions and document checklist | Improve | **Done:** per-deal checklist (outstanding / received / met / waived), an organization condition library seeded with starter conditions, smart rules (purpose, employment type, tenure) applied on create, save and status change, custom conditions; all audited. The library editor is **Done** (step 9; rules may only name real fields). **Pending:** condition groups and bundles, lender-specific conditions, rules beyond exact values |
| Secure document upload | Improve | **Done:** upload per condition (PDF, JPEG, PNG by file signature, 10 MB), private storage outside the web root, download only through a signed-in, deal-scoped, audited route sent as an attachment, soft-delete remove. **Pending:** S3 / R2 with encryption at rest and short-lived signed URLs (files are on local disk, unencrypted), virus scan, PDF conversion |
| Contacts, merge, CASL consent | Improve | **Done:** list, profile save, and CASL with a consent log, all scoped and audited. **Still missing:** merge, plus the profile fields not stored yet (DOB, SIN, marital status, employment, assets). |
| Contacts never deleted | Done | Archive sets `deleted_at`. The row stays and is hidden everywhere, and assistants can't archive. Unit and click tested. |
| My Day, reminders, tasks | Improve | **Done (step 7):** tasks table with due dates, times, assignment and audit; My Day with bulk actions; derived deal reminders. **Pending integration:** sending SMS and email |
| Calendar | Improve | **Done (step 7):** month / week / day on real tasks, drag to add and move, edit and delete. **Pending integration:** Google sync |
| Workflows, automated check-ins | Missing | Needs a job runner plus email/SMS (External) |
| Reports (production, pipeline, SLA, AML…) | Improve | **Done (step 8):** production (WTD / MTD / YTD, by status or funded by lender), pipeline by closing month and SLA by agent, all scoped SQL with drilldowns, plus audited, formula-safe CSV export. **Pending:** Credit Bureau (integration), contact one-touch reports. Borrower Risk and Sanction Screening are done (step 10). SLA targets are an organization setting (step 9); No Agent works through the deals grid filter |
| Custom report builder | Improve | **Done (step 8):** whitelisted columns and operators, parameterised values, scoped, with CSV export (tested against unknown columns and SQL injection). **Pending:** saved reports are kept in the browser only, not per user |
| Compliance dashboard and package lock | Improve | **Done (step 10):** compliance status per deal with an audited review history, Manage Compliance for org and office admins, a package lock that freezes conditions, documents and AML answers, and a scoped, searchable dashboard. **Pending:** the lock doesn't cover the deal's own fields; Compliance Settings and package logs are placeholders; admin screens not click-tested |
| AML risk and sanctions screening | External / Improve | **Done (step 10):** a per-borrower questionnaire with a computed risk, a manual record of sanction screening, and both AML reports. **Pending:** automated sanctions-list screening (needs a provider), risk override, office AML settings |
| Credit bureau pull | External | Equifax / TransUnion contracts and credentials; until then label it "Pending integration" |
| Submit to lender, lender responses | External | Lender-exchange access needed; until then export a PDF / application package |
| eSign | External | A provider such as DocuSign; pending |
| SMS | External | Twilio or similar; pending |
| Email from the broker's own address | External | SMTP / M365 / Google OAuth; pending |
| EZ Account, NOA, property validation, AltHub | External | Not planned until a provider is chosen |
| Importer | Improve | UI; needs a CSV/XLSX parser and a mapping step |
| Admin: offices, users, roles, organization toggles | Improve | **Done (step 9):** offices, users, User Matrix, deactivate with reassignment, organization settings (SLA targets, reminder thresholds, toggles), scoped so office admins only see their office; all audited. **Pending:** toggles are stored but nothing reads them, working provinces and associates, hiding admin nav from non-admins |
| Lenders, products, underwriters, lender matrix | Improve | **Done (lenders step):** lenders and products in the database, list, matrix and lender page for org admins, underwriters, fees, ratio limits used by validation, submission agents that limit which deals can pick the lender; audited. **Pending:** lender-specific conditions, commissions from fees |
| Consent templates (English/French) | Improve | **Done (step 9):** stored per office in both languages with acceptance, signature and page-break options. **Pending:** a real generated PDF (the preview is layout only), showing them to clients (step 11) |
| Logs and audit trail | Done | The `audit_log` table is written in the same transaction by every change. The Logs screen (org admins only) reads it by entity, paged, with a before/after view; password hashes are never logged |
| Webhooks, API in and out | Missing | Needs signed outbound webhooks with a retry log, and inbound API keys |
| Email domains with Azure settings | Improve | UI; tie it to the email integration |
| Auth, sessions, MFA | Improve | **Done:** email/password sign-in, 8h sessions, every page protected, scrypt hashes, a 5-try lockout. **Pending:** magic link, TOTP MFA, a lockout store shared across servers. |
| Multi-tenant data isolation (organization > office > user) | Improve (contacts and deals done) | Every query is scoped by tenant; tests prove one office can't read another |
| Role permissions | Unknown | The reference matrix couldn't be seen; we define our own (see the implementation plan) |
| Notifications | Unknown | Reference triggers not observed |
| Commission and fee splits | Unknown | Fields seen; the reference formula is unknown |

## Branding

Done 2026-10-27. The reference logo files, the name in the UI, its help links and the external links are gone. The placeholder name is "Keyway". The colours still match the reference, which is allowed, but a distinct palette is still advisable. The list below is kept for the record.

These were removed or replaced:

- `public/sites/velocity/velocity_logo.svg` and `NewtonLogoDash.png`
- The "Velocity" name in UI text, for example "Search Velocity..." and "VelocityCRM"
- Help links, phone and email that point to the reference company
- External links in `shell.tsx` (`SRC`) that send users to the real app
- Translation strings and colours copied 1:1 (colours are not protected, but a distinct palette is advisable)

Still open: choose a final product name and logo to replace "Keyway".
