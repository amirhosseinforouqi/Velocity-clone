# Deployment Checklist

Nothing in this work has been committed, pushed or deployed. Pushing to `main` deploys to production, so do
each step deliberately. Items marked **you** need your decision, credentials or approval.

## Production-readiness assessment (2026-11-14)

**Not ready for real client data.** Ready for continued internal testing with synthetic data.

| Area | State |
|---|---|
| Lead, workspace, documents, portal, messages, pipeline, calculators, tasks, calendar | Working locally; 86 automated tests pass; browser checks in `TEST_RESULTS.md` |
| Blocking before real clients | Deploying the local work (dependency upgrade, database lockout with migration `0016`, new headers); choosing a virus-scanning service; enforcing the content security policy after a staging test; staging environment and protected `main`; tested backup and restore; real email tested; regulatory review (`SECURITY_AUDIT.md` findings 2–5, 7) |
| Not built | Microsoft 365 mail/calendar, OneDrive/SharePoint, lender submission, credit bureau, sanction screening |
| Never tested | Production database, storage bucket, concurrent users, load, other browsers, screen readers |

## 1. Before deploying

- [ ] **you** Approve the release. It includes the `next` 16.4.6 upgrade; confirm `npm audit --omit=dev` still reports 0.
- [ ] `npm run check` passes on the exact commit to be deployed (lint, typecheck, tests, build).
- [ ] **you** Make the repository private or protect `main`; create a staging environment with its own database.
- [ ] **you** Back up the production database and confirm the backup restores into a scratch database.
- [ ] One schema migration is pending: `0016_login_failures`. It only adds a new, empty table and changes no
  existing data. The hosted build runs it (`vercel-build`); otherwise run `npm run db:migrate` after the backup.
- [ ] Confirm `.env.local` and any other secret file are not in the commit.

## 2. Environment variables (names only; set values in the hosting dashboard)

| Variable | Needed | Purpose |
|---|---|---|
| `AUTH_SECRET` | Yes | Signs sessions and seals SINs and MFA secrets. **Changing it makes stored SINs and MFA secrets unreadable** — keep a secure copy |
| `DATABASE_URL` (or `POSTGRES_URL`) | Yes | Production database; the app refuses to start without it |
| `APP_URL` | Yes | Base address used in invitation and reset links |
| `AUTH_TRUST_HOST` | As the host requires | Lets sign-in trust the platform's host header |
| `TIME_ZONE` | Recommended | Dates for tasks, calendar and reminders |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | Yes on serverless hosting | Document storage. The bucket must be private |
| `CRON_SECRET` | Yes | Protects the daily retention job |
| `SETUP_CODE` | First setup only | Protects creation of the first administrator; remove afterwards |
| `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` | For email | Without them nothing is sent and the screens say so |
| `MALWARE_SCAN_URL`, `MALWARE_SCAN_TOKEN` | Before real documents | Virus scanning of uploads |
| `PGLITE_DIR`, `UPLOAD_DIR` | Local only | Do not set in production |

## 3. Staging pass (synthetic data only)

- [ ] Create the first administrator; turn on MFA; add one agent and one assistant.
- [ ] Run the scenario in `TEST_RESULTS.md`: new lead, data entry, checklist, invitation, client upload, review,
      message and reply, stage change, calculators.
- [ ] Confirm an agent cannot see another agent's file and a client cannot open another client's application.
- [ ] If email is configured: send one invitation to an address you own; check delivery, the link, the
      "sent / failed" status and a bounce.
- [ ] Upload a document; confirm it lands in the private bucket and downloads only when signed in.
- [ ] Trigger the retention job once with the secret, and once without (must be refused).
- [ ] Review Admin → Organization: lead stages, lead sources, qualifying defaults (stress buffer, rate floor,
      revolving percentage). These are working defaults, not any lender's rules.

## 4. Deploy

- [ ] **you** Give the go-ahead. Merge to `main`; watch the build.
- [ ] Sign in, open one existing file, save it unchanged, confirm nothing in it changed.
- [ ] Check the hosting logs for errors for the first hour.

## 5. Rollback

- Redeploy the previous build from the hosting dashboard. Migration `0016` only adds the empty `login_failures`
  table; the previous build ignores it, so it can stay.
- Restore the database only if data was damaged, and only from the backup taken in step 1, after confirming
  with you. Never reset the production database to clear an error.

## 6. Before the first real client

- [ ] **you** Regulatory review complete (PIPEDA, FSRA, CASL, AML) — see `SECURITY_AUDIT.md`.
- [ ] Virus-scanning service chosen and live; content security policy enforced after a staging test.
- [x] Security headers added; lockout moved into the database (local only until deployed).
- [ ] Replace `SECURITY.md` with your own contact and disclosure process.
- [ ] Staff trained from `USER_GUIDE.md`; a named person responsible for access reviews and incident response.
