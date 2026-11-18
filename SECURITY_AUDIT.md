# Security Audit

Date: 2026-11-14. Scope: the Keyway application in this folder, reviewed by reading the code and by testing
the local development server with synthetic data. Production, the hosted database and external services were
**not** tested. No secret values were read out or recorded. This is a technical review, not a penetration test
and not a legal or regulatory opinion.

## Summary

The application's own access control, password handling, SIN protection and audit trail are in reasonable
shape and are covered by tests. It is **not ready for real client data** yet: the open items in "Findings"
(no virus-scanning service chosen, a content security policy that only reports and does not yet block, a public
repository that deploys straight to production, and three fixes made on 2026-11-15 that exist only on this
machine and are not deployed) must be closed first, and the regulatory items need a qualified person.

## What was checked and found sound

| Area | What the code does | How it was checked |
|---|---|---|
| Passwords | scrypt with a 16-byte random salt, constant-time comparison. Client minimum 10 characters, staff setup minimum 12. Passwords are never emailed; clients set their own through a one-time link that expires in 7 days | Code read; invitation and setup flow run in the browser |
| Staff MFA | TOTP, secret stored encrypted; a wrong code counts as a failed sign-in | Code read; automated tests |
| Sessions | Signed JWT cookie, 8-hour lifetime; the user is reloaded from the database on every request, so a disabled user or changed role takes effect immediately | Code read |
| Authorisation | Every query goes through a scope (organisation, office, agent). Admin pages return 404 to non-admins. The Admin menu is also hidden for agents and assistants | Browser: agent sees no Admin menu; automated tests |
| Client isolation | A client can only open files they are an applicant on | Browser: one synthetic client requesting another client's application got 404; a client opening a staff file URL is sent to their own portal |
| SIN | Validated, stored encrypted, shown as last 3 digits only, replaceable but not readable, never written to the audit trail | Automated test; browser check that the full number is not in the page |
| Uploads | Type decided by file content (PDF, JPEG, PNG only), 10 MB limit, file name sanitised. Files are stored outside the web root and served only through an authenticated, scoped, audited download route as attachments with `no-store` | Code read; uploads run in the browser with a synthetic PDF |
| Audit trail | Mutations run in a transaction with an audit record; deletes are soft | Code read; automated tests |
| Email honesty | With no provider configured nothing is sent and the screen says so; the status never reads "sent" | Browser |
| Scheduled job and webhook | The retention job requires a bearer secret compared in constant time; the email webhook requires its own secret | Code read |
| Secrets in the repository | `.env*` files are git-ignored except `.env.example`, which holds names only | Code read |
| Browser headers present | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`; since 2026-11-15 also `Strict-Transport-Security`, `Permissions-Policy` and a report-only `Content-Security-Policy` (local only) | Browser: framing the app was refused; headers read from responses |
| Production safety | The hosted build refuses to start without a database URL; development seed users are created only outside production | Code read |

## Findings (open)

Severity is my engineering judgement, highest first.

| # | Severity | Finding | Recommended action |
|---|---|---|---|
| 1 | Low (was High) | **Fixed locally 2026-11-14, not deployed.** `next` upgraded 16.3.5 → 16.4.6, `shadcn` moved to dev dependencies, `npm audit fix` run. `npm audit --omit=dev` now reports **0** advisories. Full `npm audit` still lists 16 in development tooling only (14 moderate, 2 low: `drizzle-kit`/`esbuild`, `shadcn`, `typescript-eslint`); none ship in the running app, and the offered fixes for `drizzle-kit` and `shadcn` are downgrades | Deploy the upgrade through staging. Re-run `npm audit` before each release |
| 2 | High | No virus scanning is configured. Client-portal uploads are quarantined until an admin releases them, and, since 2026-11-15 (local only, not deployed), documents staff attach to lender conditions go through the same scan and are refused if flagged. With no service configured nothing is actually scanned | **Still open.** Choose a scanning service and set `MALWARE_SCAN_URL` / `MALWARE_SCAN_TOKEN`. A paid service needs your approval |
| 3 | High | The repository is public and every push to `main` deploys to production. There is no staging step or required review | Make the repository private or protect `main` (required review, required checks), and add a staging environment |
| 4 | Medium | Sign-in lockout (15 minutes per email) is counted in server memory. On serverless hosting each instance has its own counter and counters reset on cold start, so the lockout is weak in production | **Fixed locally 2026-11-15, not deployed.** The counter is now in the database (table `login_failures`, migration `0016`), shared by every instance; covered by a test. Edge rate limiting is still worth adding |
| 5 | Medium | No `Content-Security-Policy`, no explicit `Strict-Transport-Security`, no `Permissions-Policy` | **Partly fixed locally 2026-11-15, not deployed.** `Strict-Transport-Security` and `Permissions-Policy` are sent. The CSP is sent in report-only mode, so it blocks nothing yet. **Still open:** test it on staging (hosted storage needs adding), then enforce it |
| 6 | Medium | Staff and client sign-ins share one session cookie. Signing in as a client in a browser replaces the staff session there. Server-side checks still hold, so this is a usability and support risk rather than a data leak | Accept, or separate the cookies if staff regularly test as clients |
| 7 | Medium | No real email has been sent, so bounce handling, the webhook and SPF/DKIM/DMARC are unverified | Verify the sending domain and test in staging before any client invitation relies on email |
| 8 | Low | `SECURITY.md` is the original template's policy and points to another project's repository | Replace with Keyway's own contact and disclosure process |
| 9 | Low | Calendar and Pipeline load every visible file and filter in memory. Fine at current size; a slow page, not a breach, at several thousand files | Query by date range when volume grows |
| 10 | Info | Uploaded-file encryption at rest, backups and their restore, log retention and access to the hosting, database and storage dashboards depend on the hosting accounts and were not inspected | Confirm in each provider's console; test one restore |

## Not tested

- The production deployment, the hosted Postgres database and the storage bucket (including bucket privacy).
- Automated vulnerability scanning, fuzzing or load; cross-site request forgery beyond the framework's built-in
  server-action origin check; other browsers.
- Real email, Microsoft 365, lender, credit-bureau and sanction-screening integrations (none exist).

## Regulatory items needing professional confirmation

Nothing here establishes compliance. Have a qualified person confirm before production use: PIPEDA consent
wording, retention periods and breach-notification procedure; where client data is hosted and whether that is
acceptable to you and your brokerage; FSRA (Ontario) record-keeping, disclosure and suitability requirements;
AML and identity-verification procedure (no screening is connected); CASL consent for email.
