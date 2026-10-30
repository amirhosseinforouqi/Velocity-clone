# RevoDoc → Keyway feature matrix

Source: [audit-notes.md](audit-notes.md) (read-only audit, 2026-10-30). Keyway code as of commit 51b29ba.

How status is decided:
- **complete**: Keyway already does it and it is covered by an existing test.
- **partial**: some of it exists.
- **missing**: nothing exists.
- **unverified**: one side could not be inspected safely.

**Existing fakes to fix or label.** These parts of Keyway look like features but are not:
- `/workflows` (`AppWorkflows` in `src/components/platform/me.tsx`) runs on placeholder data held in browser state.
- The historical deals list uses `placeholderHistorical` (`deal-lists.tsx`).
- The contact duplicate groups use `placeholderDuplicates` (`contacts.tsx`).
- The CRM donut on the home page shows 0 birthdays, anniversaries and maturities.

## Deal workspace

**1. Purpose classification**
- Keyway: `deals.purpose` column; the "Application Purpose" select in `deal-sections.ts`.
- Status: partial.
- Work: align the option list (Purchase, Refinance, Transfer, Renewal, Builder, Construction, Development, Renovations, Equity Takedown, Other).
- Verify: save and reload a deal; check the report filter.

**2. Program, with 30 options (Bad Credit … Third Mortgage)**
- Keyway: none.
- Status: missing.
- Work: a "Program" select in the deal fields. Values live in the `fields` jsonb, so no migration is needed.
- Verify: server test that saves and reloads it; the report builder can filter on it.

**3. Type: Lead, PreApproval, Approval**
- Keyway: the `deal_status` enum (lead, pre_approval, approved …).
- Status: complete.
- Work: none.
- Verify: existing deal tests.

**4. Referral linked to a contact record**
- Keyway: the "Referral" section has free-text name and company fields.
- Status: partial.
- Work: pick the referral from Contacts. Depends on #29.
- Verify: test that the referral resolves to a contact in scope.

**5. Owner and Member Access (several users per deal)**
- Keyway: `deals.agentId` and `assigneeId`; `dealScope` in `access.ts`.
- Status: partial.
- Work: a `deal_members` table, with `dealScope` widened to include members. This is a permission change.
- Verify: tests for a member who can see the deal, a non-member who cannot, and another office that cannot.

**6. Deadlines: Lender Submit, Lender Conditions, Lawyer Instructed, Closing**
- Keyway: `submittedDate`, `conditionsDate`, `closingDate`.
- Status: partial.
- Work: add a `lawyerInstructedDate` column (migration) and show all four in the deal header.
- Verify: server test; the dashboard panel (#20).

**7. Progress steps per deal type (Days, Show Milestone, Todos, Auto Messages, Pre-Requisite), plus a per-deal step checklist with dates**
- Keyway: `progress_stages`, a single client-portal list per org. `/workflows` is a placeholder.
- Status: missing (the placeholder must not count).
- Work:
  - Tables `progress_templates` (by deal type), `progress_steps` and `deal_steps`.
  - An admin editor that replaces the placeholder Workflows page.
  - A deal Progress panel: tick a step, set its date, prerequisites enforced on the server.
  - Todos become tasks.
  - Auto Messages create a reminder task. They send email only after the org turns sending on.
- Verify: tests for the template per type, the prerequisite block, todo task creation and scope.

**8. Mortgage fields: Broker File #, Origination File #, Lender Ref #, New Loan/Renewal, Prime/Sub-Prime, Rate Hold days and Expiry, Lender Commitment date**
- Keyway: the Mortgage Request section has the rate, term, amortization, payment frequency and maturity fields.
- Status: partial.
- Work: add the missing fields to `deal-sections.ts` (jsonb only).
- Verify: save and reload test.

**9. Payment computed from amount, rate, amortization and frequency**
- Keyway: `calculators.tsx` has the math; the deal "Payment" field is typed by hand.
- Status: partial.
- Work: compute it read-only in the deal from the saved fields, reusing the calculator function.
- Verify: unit check against a known payment.

**10. Several mortgages per deal (1st/2nd/3rd, Add Mortgage)**
- Keyway: one request with 1st, 2nd and 3rd totals.
- Status: partial.
- Work: later, because it reshapes the Mortgage Request section.
- Verify: n/a.

**11. Compensation: Finders Fee, Volume Bonus, Buydown Cost, Paid To Brokerage, Fee Split %, Paid To Agent, Creditor Insurance, Net**
- Keyway: the close-out "Commissions" table (Expected/Received), whose rows are static.
- Status: partial / unverified.
- Work: make the rows editable fields and compute Net.
- Verify: save and reload; Net test.

**12. Docs per condition, Send Reminder, Upload**
- Keyway: `deal_conditions`, `documents`, `document_requests` (`lastRemindedAt`), the portal upload.
- Status: complete.
- Work: none.
- Verify: `conditions.test.ts`, `portal.test.ts`.

**13. Create Package (bundle of documents for the lender)**
- Keyway: `packageLockedAt` is a compliance lock, not a bundle.
- Status: missing.
- Work: later. It needs a zip or PDF merge; nothing is installed for that.
- Verify: n/a.

**14. Notes with categories and a category filter**
- Keyway: `deal_notes` (body only); the Notes section.
- Status: partial.
- Work: a `category` column, an admin-editable category list (org settings) and a filter in the Notes tab.
- Verify: tests that saving checks the category against the org list and that the filter works.

**15. Sent and Emails per deal**
- Keyway: `email_deliveries` (portal emails, no `dealId`); the static "System Email History" columns.
- Status: partial / unverified.
- Work: add `dealId` to deliveries and list them on the deal.
- Verify: test listing scoped to the deal.

**16. Deal contacts: Add Deal Contact (lawyer, realtor, appraiser…), Add Broker Contact, BDM/Underwriter pickers**
- Keyway: `deal_borrowers` only.
- Status: missing.
- Work: a `deal_contacts` table (deal, contact, role). Depends on #29.
- Verify: tests for scope and role filtering.

**17. Reminders tied to a progress step**
- Keyway: `tasks` with `dealId`; Reminders & Tasks.
- Status: partial.
- Work: an optional `stepId` on tasks, after #7.
- Verify: test.

**18. Activity log per deal**
- Keyway: `audit_log`. The deal shows `portal_%` actions only (`portal.ts`).
- Status: partial.
- Work: an Activity view with every audit entry for the deal, for staff in scope.
- Verify: test that it is scoped and lists edits.

**19. After Care: recurring client touches (Label, Next Date, Period, Max Times, Confirm Before Sending, Receivers, Disable)**
- Keyway: none. "Maturities" and "Rate Expiries" one-touch reports are flagged not ready.
- Status: missing.
- Work:
  - An `aftercare` table.
  - Items that are due appear in My Day as tasks. They never auto-send unless sending is enabled and confirmation is off.
  - Turn on the Maturities and Rate Expiries reports.
- Verify: tests for next-date rollover, max times and disable.

**20. Send Message from the deal**
- Keyway: portal conversations and messages.
- Status: complete.
- Work: none.
- Verify: `portal.test.ts`.

## Dashboard

**21. Deadlines panel (Name, Deadline, Days To, Milestone)**
- Keyway: none. The home page has Deals and CRM cards; My Day has reminders.
- Status: missing.
- Work: a panel from the four deal date columns (#6).
- Verify: test of the next-milestone function; check in the browser.

**22. Conditions panel per deal, with counts**
- Keyway: per-deal conditions only.
- Status: partial.
- Work: Required/Rejected/Satisfied counts as a deal-list column and a dashboard panel.
- Verify: test.

**23. Pending Emails count**
- Keyway: `email_deliveries.status`.
- Status: partial.
- Work: a count on the dashboard.
- Verify: test.

## Settings

**24. Condition templates**
- Keyway: `condition_templates`, `/admin/conditions`.
- Status: complete.
- Work: none.
- Verify: `conditions.test.ts`.

**25. Progress step templates**
- See #7.

**26. Email templates (user and group scope, data-mapping variables, attachments)**
- Keyway: `email_templates`, the fixed portal kinds only.
- Status: partial.
- Work: later. Custom templates with merge variables. Sending stays behind the org's Resend setup.
- Verify: test of the variable render.

**27. PDF templates**
- Keyway: none.
- Status: missing.
- Work: later. It needs PDF generation.
- Verify: n/a.

**28. Note categories**
- See #14.

**29. Contact roles and sub-roles (34 roles)**
- Keyway: contacts have no role or company.
- Status: missing.
- Work: `role`, `subRole` and `company` on contacts, with an admin sub-role list.
- Verify: test.

**30. Contact Document Templates**
- Keyway: n/a.
- Status: unverified.
- Work: inspect first.
- Verify: n/a.

## Tools and reports

**31. Lenders**
- Keyway: `lenders`, `lender_products`, `/admin/lenders`.
- Status: complete.
- Work: none.
- Verify: `lenders.test.ts`.

**32. Contacts list (Company, Role, Sub-Role, Public, Group)**
- Keyway: the `/contacts` page.
- Status: partial.
- Work: the role columns from #29.
- Verify: browser check.

**33. Contact groups**
- Keyway: none.
- Status: missing.
- Work: skip unless needed. The role filter covers most uses.
- Verify: n/a.

**34. Customer Tracking: filter by deal state, purpose, term type, term, rate type, client rate ≥, residential/commercial, date field (Created/Closing/Maturity/Aftercare)**
- Keyway: the report builder (`builderFields` in `reports.ts`).
- Status: partial.
- Work: add term, rate type, rate, maturity and program to the whitelisted builder fields; add a "Customer Tracking" preset.
- Verify: `reports.test.ts` additions.

**35. Sales Tracking: status, lender, funded, broker, mortgage position, referrer, dates; Export PDF**
- Keyway: Production and Pipeline reports; `exportReport` (CSV).
- Status: partial.
- Work: add the referrer and position filters, and a print stylesheet for "PDF" (the browser's own print-to-PDF).
- Verify: test plus a browser check.

**36. Saved custom reports**
- Keyway: the builder runs ad hoc from the URL, with nothing saved.
- Status: partial.
- Work: a `saved_reports` table (name plus query string), per user.
- Verify: test that a saved report re-runs with the user's own scope.

**37. Group variants of reports**
- Keyway: `dealScope` by role (org_admin sees all).
- Status: complete.
- Work: none.
- Verify: `reports.test.ts`.

**38. Rates**
- Keyway: n/a.
- Status: unverified.
- Work: inspect first.
- Verify: n/a.

## Accounts

**39. Profile, reminder-email toggle**
- Keyway: `/account`, `users.details`.
- Status: unverified.
- Work: check whether the toggle exists.
- Verify: browser check.

**40. Change password**
- Keyway: `password.ts`, account page.
- Status: unverified.
- Work: check.
- Verify: test.

**41. Members with Admin, Agent and SuperUser flags**
- Keyway: roles, `/admin/users`, user matrix.
- Status: complete.
- Work: none.
- Verify: `admin.test.ts`.

**42. Per-user SMTP password for outgoing mail**
- Keyway: Resend at org level.
- Status: by design.
- Work: do not build. Storing users' mail passwords is a liability; Resend with a verified domain covers it.
- Verify: n/a.

**43. Subscription and billing**
- Keyway: n/a.
- Status: not relevant.
- Work: none.
- Verify: n/a.

## Build plan (proposed order, each one a full vertical slice with a test)

1. **Deal classification and mortgage fields** (#1, #2, #8, #9). These are field definitions only: no migration, no permission change.
2. **Note categories** (#14, #28): a column, an admin list and a filter.
3. **Deal Activity view** (#18): read-only, scoped.
4. **Lawyer Instructed date and dashboard Deadlines panel** (#6, #21, #22): one migration.
5. **Contact roles, deal contacts and referral picker** (#29, #16, #4, #32).
6. **Progress templates per deal type with todos and prerequisites** (#7, #17). This replaces the placeholder Workflows page.
7. **After Care, Maturities and Rate Expiries** (#19). No automatic sending.
8. **Customer and Sales Tracking filters, saved reports, print to PDF** (#34, #35, #36).

Later, each needs its own go-ahead:
- Member Access (#5, a permission change).
- Custom email templates (#26).
- PDF templates (#27).
- Create Package (#13).
- Multiple mortgages (#10).
- Compensation net (#11).
- Contact groups (#33).

Every slice uses synthetic `@keyway.test` data. Nothing sends email or SMS on its own.

## Progress

- **Slice 1 done** (#1, #2, #8, #9).
  - Application Purpose includes RevoDoc's purposes.
  - The Program select has 30 options.
  - A "File and Lender Details" group: Broker/Origination File #, Lender Ref #, Credit Tier (Prime/Sub-Prime), Rate Hold Days and Expiry, Lender Commitment.
  - Amortization months, plus Quarterly, Semi-Annually and Annually payment frequencies.
  - A read-only Calculated Payment (`contractPayment` in `src/server/metrics.ts`), live as you type and never stored.
  - The report builder filters on Program, Term and Rate Type.
  - New Loan/Renewal is covered by the existing Application Type.
  - Tests: `metrics.test.ts`, `reports.test.ts`.
- **Slice 2 done** (#14, #28).
  - Notes have a category (migration 0010, `deal_notes.category`); the server rejects any category not in the organization's list.
  - Admins edit the list under Admin > Organization > Note Categories, one per line; it starts with RevoDoc-style defaults.
  - Staff Notes on the Client Portal tab: category picker, All Categories filter, text search.
  - Verified in the browser as an agent. The admin editor is covered by tests only.
- **Slice 3 done** (#18).
  - New Activity tab on each deal: date, who, action, details for every audit entry on the deal and its tasks, conditions and documents, newest first (`dealActivity` in `src/server/deals.ts`).
  - Only staff who can see the deal; edits list the changed field labels, never their values.
  - Not built: RevoDoc's "Deal viewed" entries, since Keyway doesn't log views.
