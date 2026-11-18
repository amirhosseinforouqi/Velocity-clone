# Implementation Plan

| Phase | Scope | State |
|---|---|---|
| A. Audit | Read the repository, map routes, data and workflows | Done (`SYSTEM_AUDIT.md`) |
| B. New Lead | Form, duplicate check, create-only and create-and-invite, starter checklist | Done, tested |
| C. Workspace | Header, nine tabs, single save, repeated entries, legacy URL redirects | Done, tested |
| D. Data entry | Multiple employments, other income, assets, liabilities, business-loan group, ratios | Done, tested |
| E. Documents, portal, messages inside the file | Checklist edits, invitation with review + confirm, upload, review, secure message | Done, tested |
| F. Pipeline and calculators | Stage change consistency, calculators start from the file | Done, tested |
| G. Hardening and documents | SIN encryption and masking, audit noise fix, these documents | Done |
| H. Follow-up round | Admin menu by role, calculated totals, staff drag-and-drop (checklist and lender conditions), configurable qualifying defaults, pipeline volume for early files, portal wording, calendar key dates, first-contact task, `SECURITY_AUDIT.md`, `DEPLOYMENT_CHECKLIST.md` | Done, tested |

## Next, in order

1. **Email provider** — set `RESEND_API_KEY` and `EMAIL_FROM` in a staging environment and test real delivery,
   bounces and the "sent / failed" statuses. Needs your approval and a sending domain.
2. **Dependency advisories** — done locally: `next` 16.4.6, `shadcn` moved to dev dependencies, runtime
   advisories 0. Still to deploy through staging.
3. **Virus scanning** for all uploads, including lender-condition documents. Needs a service (possibly paid).
4. **Staging and a protected `main`**; lockout counter in the database; security headers (CSP, HSTS).
5. **Microsoft 365** mail/calendar and OneDrive/SharePoint — needs an Entra app registration and consent.
6. **Lender submission**, credit bureau, sanction screening — need vendor agreements and credentials.
7. **Per-lender qualifying rules** (today: one set per organization).
8. **Regulatory review** by a qualified person (PIPEDA, FSRA, CASL, AML).

Details: `SECURITY_AUDIT.md` and `DEPLOYMENT_CHECKLIST.md`.

## Release

Nothing has been committed, pushed or deployed. The repository auto-deploys `main` to production, so a release
needs your explicit go-ahead, a database backup, and a staging pass first. No database migration is required by
this work.
