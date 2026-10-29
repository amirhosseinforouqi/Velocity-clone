# Client portal and firm workspace

This file describes what branch `feature/client-portal` actually built, how it is secured, and where each requirement stands.
All data in this repository, its tests and its screenshots is synthetic.

## Architecture as built

| Concern | What runs | Notes |
|---|---|---|
| App | Next.js 16 App Router, server actions, React 19, Tailwind v4 | The portal reuses the existing Keyway design (`ui.tsx`, `shell.tsx`). |
| Database | Postgres through Drizzle. PGlite locally and in tests, `DATABASE_URL` (Supabase) when set | Migrations `drizzle/0007_portal.sql` and `drizzle/0008_portal_rls.sql` add the portal. `npm run db:migrate` applies them. |
| Staff sign-in | Auth.js credentials provider, scrypt hashes, optional TOTP (RFC 6238) | The org setting "Require staff MFA" sends staff without MFA to `/user/mfa` (`src/auth.ts:42`). |
| Client sign-in | Auth.js `client` provider with its own account table | The session carries `kind` (`staff` or `client`). `requireActor` and `requireClient` in `src/auth.ts` refuse the wrong kind. |
| Files | Supabase Storage, private bucket `client-documents`, through a server-side service-role client. Local disk when Supabase isn't configured | Uploads go straight to storage through a signed upload URL. Downloads use a 60-second signed URL (`src/server/storage.ts:74`). |
| Email | Resend over its HTTP API | Without `RESEND_API_KEY`, the delivery is stored as `not_configured` and staff see the invite link so they can share it themselves. No send is ever faked. |
| Malware scan | An HTTP scanner at `MALWARE_SCAN_URL` | Without one, uploads are `not_scanned` and stay in quarantine until an admin releases them. |
| Live updates | Polling (`usePoll`) | Supabase Realtime isn't used. |
| Retention | Vercel cron `/api/cron/retention`, guarded by `CRON_SECRET` | After the firm's retention period, it purges the files and message bodies of closed deals and ends portal access. |

### Deviations from the original plan

- **Auth.js instead of Supabase Auth.** The app already used Auth.js for staff. Clients were added as a second provider rather than running two auth systems.
- **Deny-all row-level security.** `0008_portal_rls.sql` enables RLS on every public table and revokes all access from `anon` and `authenticated`.
  - Browsers never talk to Supabase with a user token. Only the app server does, as the table owner, and it authorizes every request in code.
  - Client-facing `auth.uid()` policies would only matter if browsers queried Supabase directly, which they don't.
- **Polling instead of Realtime**, for the same reason.

## Access model

- **Firm:** every staff query is scoped to the actor's organization (`src/server/access.ts`).
- **Roles:**
  - Firm admins (`org_admin`, `office_admin`) manage templates, checklists, stages and settings, and release files from quarantine.
  - Staff (agents and assistants) work the deals they can see.
  - Clients use the portal only.
- **Application:** a client sees a deal only through an active applicant link with portal access turned on.
- **Applicant privacy:** a document request, conversation or file can be private to one applicant. Co-applicants on the same deal don't see it.
- **Internal:** staff notes and the internal status are never part of any client response.

## Requirement checklist

Status key:

- **Verified:** implemented and tested, by an automated test or a browser check named under Evidence.
- **Implemented:** built and type-checked, maybe partly tested, but not run end to end.
- **Blocked:** needs access or setup I don't have.

The tests are in `src/server/portal.test.ts`. "Browser" means checked in the local preview as a synthetic client on 2026-10-29.

### Firm workspace

| Requirement | Status | Evidence |
|---|---|---|
| Client invitations and welcome emails from editable templates | Verified (logic); Blocked (real send) | Test "full workflow" creates an invite with delivery `not_configured` and a link. Templates: `listTemplates` and `saveTemplate` in `portal-admin.ts`. A real send needs a Resend key and a verified domain. |
| Invite expiry, resend and revoke | Verified (expiry, single use); Implemented (resend, revoke) | The test proves a token works only once. Expiry is a firm setting. Functions: `inviteApplicant`, `resendInvitation`, `revokeInvitation`. |
| Delivery status and failure tracking | Verified | Test "Resend webhooks": a signed `email.bounced` event marks the delivery bounced. Tampered or stale signatures are rejected. |
| Document requests, one at a time or from a checklist | Verified | Test "full workflow" creates both kinds. |
| Statuses: requested, uploaded, under review, accepted, replacement required with a reason | Verified | Test "full workflow": asking for a replacement without a reason fails; version 2 is then accepted. |
| Versions, reminders and downloads | Verified (versions, downloads); Implemented (reminders) | Versions and the `staffFile` and `clientFile` downloads are tested. `remindRequest` sends a notification, and an email with no document details. |
| Organized by application, applicant and category | Implemented | The "Client portal" tab on the staff deal page. |
| Configurable progress stages (the eight listed) | Verified | `ensurePortalDefaults` seeds them; Admin → Client portal edits them. The `setStage` test checks done, current and upcoming. |
| Internal status kept separate from client updates | Verified | Clients see only the stage update text. Test "isolation" shows notes and internal status are absent from the client JSON. |
| Secure messaging per application: attachments, unread counts, timestamps, read status | Verified | Test "full workflow" covers messages, unread counts and seen state. Test "isolation": attaching another applicant's file is rejected. Browser: the client opened a thread and replied. |
| Email notifications without sensitive content | Implemented | Notification emails only say something changed and link to the portal. |
| Staff-only internal notes | Verified | `addNote`. A test confirms notes never reach the client. |
| Staff dashboard: pending invites, unread messages, outstanding documents, awaiting review, needing attention | Implemented | `portalDashboard`. Not checked in a browser as staff (see Unverified). |
| Assignment, notifications and activity | Implemented | `assignDeal`, `notifyStaff`, `readStaffNotifications` and the existing activity log. |

### Client portal

| Requirement | Status | Evidence |
|---|---|---|
| Same app and branding | Verified | Browser: `/portal` uses the Keyway shell and type. |
| Accept the invite and sign in | Verified | Test: a short password is rejected, and the token works once. Browser: accepting the invite signs the client in and lands on the application. |
| See only authorized applications | Verified | Test "isolation": a stranger gets Forbidden, and access ends when portal access is turned off. Browser: an unknown application ID returns 404. |
| Progress and next steps | Verified | Browser: the stage chips, update text and next action are shown. |
| Upload from desktop or mobile | Verified (local); Unverified (Supabase) | Browser: a real upload through the signed URL to local storage ended as Uploaded, with the file in quarantine. The Supabase signed-upload PUT hasn't run yet. |
| Review statuses visible | Verified | Browser, and test "full workflow". |
| Message the team | Verified | Browser and test. |
| Notifications | Implemented | `clientNotifications`, shown in the portal header. |
| Update permitted contact info | Verified | Browser: the profile page saves phones and address. The client can't change their sign-in email. |
| Multiple applicants with private visibility | Verified | Test "isolation": the primary applicant can't see a co-applicant's private request, conversation or file. |
| Clients kept out of staff pages | Verified | Browser: `/` and `/admin/users` redirect a client to `/portal`. |
| Responsive and accessible | Verified (spot check) | Browser at 375px wide. The sign-out button has an accessible name. |

### Security

| Requirement | Status | Evidence |
|---|---|---|
| Supabase Postgres and private storage | Implemented; Blocked (dev project created, not migrated) | Uses `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `npm run db:migrate` also creates the private bucket. |
| RLS on all tables | Verified | Test "every table has row-level security on" queries `pg_class` and finds no table without it. |
| Storage policies | Implemented | The bucket is private and has no `public` or `authenticated` policies, so only the service role can reach it. |
| Short-lived signed URLs | Implemented | Downloads: 60 seconds. Upload URLs: Supabase's default lifetime on Supabase, 15 minutes locally. |
| Server-side authorization | Verified | Every action goes through `requireActor` or `requireClient` and then the scope checks above. The tests call the server functions directly. |
| Secure invite acceptance and account linking | Verified | Tokens are random, stored as SHA-256 hashes, single-use and expiring. An invite to an email that already has a client account links to that account instead of creating a second one. |
| Staff MFA | Verified | Test "TOTP": the RFC 6238 test vectors pass, and sign-in refuses a wrong code. |
| File type and size checks, safe filenames, scan or quarantine | Verified | Test "uploads": `.exe` files and files over 10 MB are rejected. A file named `.pdf` that contains a Windows executable is rejected and deleted. Names are sanitized, and unscanned files are quarantined. |
| Audit without document contents or secrets | Implemented | Audit rows record the actor, the action and IDs only. `auditDownload` and `auditClientDownload` log downloads. |
| Retention and deletion | Verified | Test "retention": files purged, messages blanked, access removed. |
| No service-role key in the frontend | Verified | The key is read only in `src/server/storage.ts` and `scripts/db-migrate.ts`, and has no `NEXT_PUBLIC_` prefix. |
| Synthetic data only | Verified | The seed and the tests use only `@keyway.test` and `@example.test` addresses. |

### Deployment

| Step | Status | What is needed |
|---|---|---|
| Feature branch | Done | `feature/client-portal`. |
| `npm run check` | Verified | Lint, typecheck, 63/63 tests and the production build all pass. |
| Push to the new private GitHub repo | Blocked | The repo URL (create it on GitHub, private, no README). `gh` isn't installed here. |
| Supabase dev project | Created; Blocked (not migrated) | `keyway-dev`, ref `jaccnlkobpywpuhufzaw`, ca-central-1, Free plan. `SUPABASE_URL` and a commented `DATABASE_URL` template are in `.env.local`. Needed: the database password (Project Settings → Database → Reset) in `DATABASE_URL`, and the `service_role` key in `SUPABASE_SERVICE_ROLE_KEY`. Then `npm run db:migrate`. |
| Supabase prod project | Blocked | The Free plan allows two active projects, and both are in use. Upgrade, or pause a project. |
| Resend | Blocked | `RESEND_API_KEY`, a verified sending domain for `EMAIL_FROM`, and `RESEND_WEBHOOK_SECRET`. |
| Vercel project, env vars and deploy | Linked; Blocked (deploy) | Project `keyway` is linked and has no env vars yet. The app refuses to start on Vercel without `DATABASE_URL` (`src/server/db.ts`), so deploy after the Supabase step. On Vercel, use the transaction pooler (port 6543). |
| Production verification | Blocked | Everything above. |

## Unverified, and known limitations

- **Staff UI not clicked through.** It needs a staff sign-in, which only the user does. The tests cover the server functions behind it.
- **No client password reset.** Staff resend an invite instead.
- **Sign-in lockout lives in memory.** It resets on restart and isn't shared between Vercel instances.
- **One session per browser.** Signing in as a client replaces a staff session in the same browser, and vice versa.
- **Condition uploads hit Vercel's ~4.5 MB request-body limit.** These pre-date the portal and go through server actions. Portal uploads use signed URLs and aren't affected.
- **`AUTH_SECRET` must be set in production.** Don't rely on the development fallback.
- **No virus scanning out of the box.** Until `MALWARE_SCAN_URL` points to a real scanner, an admin must release every upload by hand.

## Environment variables

See `.env.example`. Server-only: `AUTH_SECRET`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`, `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `MALWARE_SCAN_URL`, `MALWARE_SCAN_TOKEN`, `CRON_SECRET`, `APP_URL`, `TIME_ZONE`.
