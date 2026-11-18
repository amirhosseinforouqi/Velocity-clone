# CRM Specification

## Records

- **Client (contact)** — name, email, phone, address, tags, notes. One client can have many files.
- **File (deal)** — belongs to an organization, an agent and optionally an assistant; links to one or more clients.
  Status `lead` makes it a lead.

## New Lead form

| Field | Rule |
|---|---|
| First name, last name | Required |
| Email | Required to invite; format checked |
| Phone | Formats as 416-555-0100 while typing; 10 digits |
| What is this application for? | Purchase, Refinance, Business Loan |
| Employment situation | Employed, Self-employed, Independent contractor, Retired, Other |
| Assigned agent / assistant | Defaults to the person creating the lead |
| Lead source, note | Optional |

Duplicate check: matching email or phone among clients you may see is shown before creating; you can open the
existing client or continue.

Buttons: **Create Lead Only** (no email) and **Create Lead & Invite Client** (shows the welcome email for review,
then asks for confirmation).

On create: client record, file in `Lead` status with stage "New Lead", starter fields for the application type and
employment situation, and the default document checklist.

## Lead stages and sources

Defaults: New Lead, Contacted, Follow-up Required, Application Started, Documents Pending, Under Review,
Converted to Active Application, Lost / Inactive. Stages and sources are edited by an organization admin in
Admin → Organization. The lead stage is a field on the file ("Set lead stage…" under Change Stage).

## Conversion

Change Stage → Pre-Approvals or New Deals. The file keeps every field, document, message and note. The move is
checked against the allowed transitions, written to Stage History and the audit trail, and shows immediately in
the Pipeline.

## Portal invitation status

Shown as a chip in the file header: Not invited · Invitation prepared — not emailed · Invitation sent ·
Invitation pending · Portal account activated · Invitation expired · Delivery failed. "Sent" is shown only when
the email provider accepted the message.

## Access rules

Agents see their own files and clients; assistants see files they are assigned to; office and organization admins
see their office or organization. Every server call re-checks this. A signed-in client who opens a staff URL is
sent back to their own portal (tested).

## Timeline

Activity History lists who did what and when: saves (field names only), stage changes, document requests,
uploads, reviews, invitations, messages.

## Not built

Tag-based campaigns, referral-partner reporting, bulk import of leads from web forms, automatic lead assignment.
