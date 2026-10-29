# Client portal and firm workspace

This file holds the plan, the data model and the requirement checklist for the client portal work on branch `feature/client-portal`.
All data in this repository is synthetic.

## Stack, as found

- Next.js 16 (App Router, server actions), React 19, Tailwind v4, TypeScript strict.
- Drizzle ORM. Migrations are in `drizzle/`.
- Local and test database: PGlite (in-process Postgres).
- Staff sign-in: Auth.js credentials with scrypt hashes.
- Uploads: local disk.
- Authorization: app-level scoping in `src/server/access.ts`.
- Visual language: `src/components/platform/ui.tsx` and `shell.tsx`.

## What changes

### Database

- **Local:** PGlite, as before.
- **With `DATABASE_URL` (Supabase Postgres):** postgres-js. The schema and queries are the same in both cases.
- **Migrations:** `npm run db:migrate` applies them to Supabase. Migrations are never run from a serverless cold start.

### Auth

**With Supabase configured** (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`), Supabase Auth handles both staff and clients:

- Email and password sign-in.
- TOTP MFA for staff, enforced per firm (aal2).

**Without Supabase**, only for local development and tests:

- Staff use Auth.js credentials.
- Clients use a scrypt password on the `clients` row.
- In production this fallback is refused.

### Storage

**With Supabase configured** (`SUPABASE_SERVICE_ROLE_KEY` server-only):

- A private bucket, `client-documents`.
- The browser uploads through a single-use signed upload URL, so files never go through the Vercel body limit.
- Downloads use 60-second signed URLs, issued only after an authorization check and an audit record.

**Without Supabase:** the disk is used, with HMAC-signed, short-lived upload and download routes.

### Email

- Provider: Resend over `fetch`, configured by `RESEND_API_KEY` and `EMAIL_FROM`.
- Every send is recorded in `email_deliveries` with one of these statuses: `sent`, `failed` or `not_configured`.
- The Resend webhook (`RESEND_WEBHOOK_SECRET`, Svix signature) updates deliveries to `delivered`, `bounced` or `complained`.
- When delivery is not configured, the UI says so. It never reports an email as sent.

### Malware scanning

- With `MALWARE_SCAN_URL` set, each upload is posted to that ClamAV-REST-style endpoint, and an infected file is rejected.
- Without it, uploads stay in quarantine (`scan_status = not_scanned`). Staff must explicitly release a quarantined file before anyone can download it, and each release is audited.

### Realtime

- With Supabase configured, the portal and the staff Client Portal tab subscribe to `messages` and `notifications` inserts. Those subscriptions go through RLS.
- Otherwise both refresh on an interval.

## Mapping onto the existing model

| Requested entity | Table |
|---|---|
| firms | `organizations`, plus portal settings columns |
| memberships (firm admin, staff) | `users`: `org_admin` is the firm administrator, and `office_admin`, `agent` and `assistant` are staff. `auth_user_id` links the user to Supabase Auth. |
| clients | `clients` (new): one row per firm and person, linked to a contact and to `auth_user_id` |
| applications | `deals`, plus `assignee_id`, `client_stage_id` and `portal_closed_at` |
| applicants | `deal_borrowers`, plus `portal_access` (per-applicant access) |
| invitations | `client_invitations` (new): hashed token, expiry, resend count, status |
| email templates and deliveries | `email_templates`, `email_deliveries` (new) |
| document requests and checklists | `document_requests`, `document_checklists` (new) |
| document versions | `document_versions` (new) |
| progress stages and updates | `progress_stages`, `progress_updates` (new) |
| conversations and messages | `conversations`, `messages`, `message_attachments`, `conversation_reads` (new) |
| internal notes | `deal_notes` (new; staff only, never exposed to clients) |
| notifications | `notifications` (new) |
| audit events | `audit_log`, plus `actor_client_id`. `actor_id` becomes nullable for client actions. |

## Visibility rules

### Staff

- Staff see an application if `dealScope` allows it:
  - `org_admin` sees the whole firm.
  - `office_admin` and `assistant` see their office.
  - An agent sees deals where they are the agent or the assignee.
- Everything is scoped to the staff member's `organization_id`.

### Clients

- A client sees an application only when their contact is an applicant on it with `portal_access = true`, within the same firm.
- Document requests and conversations each carry an `applicant_contact_id`:
  - `null` means shared with every applicant who has access.
  - A set value means private to that applicant.
- One applicant never sees another applicant's private requests, files or conversations.
- Internal notes, internal status, staff-only notes on requests, the audit log and other clients are never returned by any client query.
- Postgres RLS mirrors these rules for the `authenticated` role, using `auth.uid()`. This makes the Supabase Data API and Realtime safe even though the app server reads with its own connection.

## Requirement checklist

Status values:

- **implemented:** code exists.
- **verified:** a test or browser check passed; the evidence is noted.
- **blocked:** needs something only the owner can provide.

The checklist is filled in at the end of the work; see the section below.
