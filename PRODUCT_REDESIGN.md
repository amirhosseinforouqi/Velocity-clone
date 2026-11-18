# Product Redesign — One Workspace per Client File

Status: implemented and tested locally with synthetic data. Not committed, pushed or deployed.

## The problem

Opening a lead or deal showed reminders and tasks first; borrower and mortgage information was spread over many
tabs and was hard to find, enter or edit. A lead and an application were handled in different places.

## What changed

1. **One record, one workspace.** A lead is a file in the `Lead` status. The same workspace becomes the application,
   so nothing is retyped at conversion. Changing the stage is the conversion.
2. **New Lead** is a prominent button in the sidebar. A short form creates the client, the file and the default
   document checklist, then opens the workspace.
3. **Compact header** with the things asked for most: name, phone, email, application type, stage, portal status,
   agent, assistant, GDS/TDS/LTV, key dates, a document summary and the next action.
4. **Nine tabs in working order**: Client & Applicants, Employment & Income, Assets & Liabilities,
   Property & Mortgage, Documents, Messages, Lender & Stage, Tasks & Follow-ups, Activity History.
   Every field is editable in place; one Save button saves all tabs.
5. **Tasks and reminders moved** to their own tab; the header shows only the next action.
6. **Portal, documents and messages live inside the file** rather than in a separate screen.

## Navigation

Dashboard · Pipeline · Messages · CRM & Contacts · Tasks & My Day · Calendar · Reports · Admin · Support, with
Calculators in the top bar and New Lead above the menu. Old deal URLs (for example `/deal/{id}/clientPortal`)
redirect to the matching new tab.

## Product decisions

| Decision | Reason |
|---|---|
| Lead = file with status `lead` plus a configurable lead stage | One source of truth; conversion loses nothing |
| No new database tables; repeated entries are numbered groups in the existing field store (4 applicants, 4 employments, 4 other incomes, 8 assets, 10 liabilities) | Smallest safe change; no migration of existing data |
| Client name, email and phone are edited on the client record ("Edit Client") | They are shared by every file for that client |
| Invitation uses a one-time setup link that expires in 7 days; the client chooses the password | No password is ever emailed |
| Every invitation shows the email for review and needs a confirm click | Nothing is sent by accident |
| With email not configured, the invitation is "prepared — not emailed" and the link is shown once to staff | No fake "sent" status |
| SIN is encrypted at rest, shown masked (last 3 digits), replaceable but not readable, and absent from the audit trail | Sensitive-field protection |
| Ratios include every current job, other income and listed liabilities; revolving debt with no payment counts 3% of balance; qualifying rate is the greater of contract + 2% and 5.25%. All three numbers are editable in Admin → Organization → Qualifying Defaults | Working defaults only — **not any lender's rules** |
| Asset, liability and net-worth totals are calculated from the entries and are read-only | No retyping, no drift |
| The Admin menu is hidden for agents and assistants (the server refuses access as before) | Less clutter |
| Every new lead gets a "First contact" task today for its agent; closing, conditions and follow-up dates show on the Calendar | Nothing depends on someone remembering to make a task |
| Mortgage amount falls back to loan amount, then price less down payment | Ratios appear as soon as the basics are entered |
| Microsoft 365 / OneDrive / SharePoint not built | No credentials available; nothing is simulated |

## Not done (stated plainly)

- Microsoft Graph email/calendar, OneDrive/SharePoint sync, lender submission (Velocity/Filogix/REVO APIs).
- Real email delivery has never been tested (no provider configured); credit bureau, sanction screening and
  virus scanning are not connected.
- Qualifying defaults are per organization, not per lender.
- An income/affordability calculator; the header ratios cover GDS/TDS.
- A user-editable automation rule builder. Built-in automations only: starter checklist, first-contact task,
  reminders, smart conditions.
- Two-way calendar sync with Outlook or Google.
- The security findings in `SECURITY_AUDIT.md`; the release steps in `DEPLOYMENT_CHECKLIST.md`.

## Regulatory items needing professional confirmation

This is a technical build, not a compliance opinion. Before production use, have a qualified person confirm:
PIPEDA consent wording and retention periods; FSRA (Ontario) record-keeping, disclosure and suitability
requirements; where client data is hosted; breach-notification procedure; AML/identity-verification process
(sanction screening is not connected); and email consent under CASL.
