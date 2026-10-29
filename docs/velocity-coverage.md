# Velocity inspection coverage

How much of Velocity was inspected. The details are in [velocity-feature-inventory.md](velocity-feature-inventory.md).

## Status key

- **Verified**: Inspected and verified. Rendered live and looked at, read-only.
- **Partial**: Partially inspected. Seen live, but its forms and actions were known only from templates and never exercised.
- **Docs only**: Described in documentation only (help menu).
- **Blocked**: Blocked or inaccessible for this user, or unsafe to exercise.
- **Not yet**: Not yet inspected.

"Verified" means the screen and its options were seen. It never means an action was run, since nothing was saved, sent or submitted.

| Area | Status | Notes |
|---|---|---|
| Sidebar, top bar, Me menu, feeds, calculators menu, help menu | Verified | |
| Router state table, about 100 states | Verified | Read from `$state`; no data |
| Home dashboard | Verified | |
| Deals dashboard, card view | Verified | Layout measured |
| Deals dashboard, grid view | Partial | From template |
| Deal workspace, 8 tabs and 13 sections | Partial | Layout seen; fields from templates; actions never run |
| Save + Validate rules | Partial | Panel template only; rule list unknown |
| Submit / update lender, lender responses | Blocked | External lender exchange; would submit a live application |
| Add Lead / Contact / Application | Partial | Templates only; nothing created |
| Add Client Experience | Partial | Template read; **Send emails a client**, never clicked |
| Client Experience templates (profile) | Partial | Bundle code only |
| Client portal, document upload | Docs only | Upload is forbidden without approval |
| Smart conditions | Docs only | |
| Conditions & documents section | Partial | Template |
| Credit bureau pull | Blocked | Would pull live credit |
| Credit Bureau report | Partial | Template |
| Compliance settings | Verified | |
| Compliance dashboard and lock package | Partial | Template labels |
| AML reports (risk, sanctions, per agent) | Partial | Menu seen; states from template |
| My Day | Verified | Bulk actions not run |
| Reminders, new applications, messages lists | Partial | Feeds seen; lists from template |
| Calendar | Verified | Google sync not connected |
| Workflows (Active CRM) | Partial | Page seen; automation behaviour from docs |
| Contacts list | Verified | |
| Contacts profile and merge | Partial | Merge never run |
| Duplicates report, contact by phone | Partial | Template |
| Reports: build, one-touch, production, pipeline, no agent | Verified | Menu and pages |
| Reports: SLA, AIR, consumed products, queued CRM, compliance | Partial | Template |
| Importer | Partial | Page seen; no file imported |
| Historical, restore, parked deals | Verified | Lists only |
| eSign and eSign history | Docs only | Plus the history template; never requested a signature |
| SMS (Twilio connect) | Blocked | External account link |
| Connect email, Google Calendar sync | Blocked | External OAuth; not granted |
| EZ Account, NOA, property validation, AltHub | Docs only | Paid external services |
| VelocityCRM, Discovery, Velocity3 Beta | Not yet | Separate apps, out of scope |
| Manage Subscriptions, MPP Hub | Not yet | External sites |
| Admin: offices, users, user matrix, organization, lenders, lender matrix, logs | Blocked | No admin links for this user; screens built from templates |
| Support: email domains, webhooks | Blocked | Same |
| Office AML settings, AML detail | Blocked | |
| Previous Deals submenu | Not yet | Skipped on purpose (client names) |
| Permissions per role | Not yet | Only one role available |
| Notifications, emails sent by the system | Not yet | Would need test records |

## What would need your approval to go further

1. **A test deal and test contact in Velocity**, using fake data. This would let me watch status transitions, Save + Validate, conditions and reminders. It creates live records.
2. **A Client Experience sent to an address you own**, to see the client-side application and portal. It sends an email.
3. **An admin-role login**, given by you, not by me. This would let me see the admin and support screens live instead of from templates.

None of these were done.
