# Velocity feature inventory

Reference: Velocity, a Canadian mortgage-broker deal management app, used read-only in the user's signed-in Chrome session.
Mapped between 2026-10 sessions. No client data is recorded here. Names, deal numbers, addresses, amounts and emails were never copied.

## Evidence labels

Each item says how it was learned:

- **Seen**: the page or menu was rendered live and looked at. Nothing was saved, sent or submitted.
- **Template**: read from the app's own static HTML templates, translation table, ui-router state table or JS bundle. These are code and labels, not data. The fields and actions exist, but nothing was exercised.
- **Docs**: only described in Velocity's in-app help menu (titles and one-line summaries). Not seen working.
- **Blocked**: not reachable for this user, for example admin screens with no menu links.
- **Inferred**: a reasonable guess from names. Treat it as unknown until it is checked.

Roles seen: the signed-in user is a broker/agent. Admin and Support screens exist in the state table, but this user has no links to them, so the roles that can reach them are **inferred** (office admin, org admin, Newton support).

## 1. Navigation (Seen)

- **Sidebar:**
  - Add (Client Experience, Application, Contact, Lead)
  - Home
  - Dashboard
  - Contacts (List, Merge Contacts)
  - My Day
  - VelocityCRM (separate app)
  - Reports (Build a Report, One-Touch, Production, No Agent Assigned, Pipeline, SLA, Credit Bureau, Borrower Risk Assessment, Borrower Sanction Screening)
  - Calendar
  - Deal: [current deal] (8 tabs)
  - Previous Deals (not read, on purpose)
  - Discovery (separate app)
  - Tools (Importer)
  - Historical Deals
  - Parked Deals
- **Top bar:**
  - Global search ("Search Velocity...") and scope select
  - Calculators: Scenario Builder, Mortgage, Purchase, Closing Costs, Land Transfer, plus an external mobile-app link
  - Help: Help Centre, phone, email, and 36 training articles (see §14)
  - Three feeds:
    - New applications (See all / Mark all as viewed)
    - Messages (See all / Mark all as read)
    - Reminders (See all)
- **Me menu:** Settings, Profile, Compliance Settings, Workflows, Manage Subscriptions (external), MPP Hub (external), Velocity3 Beta (external), Log Out
- **Router:** about 100 ui-router states (Template). Groups: dashboard, deal, contact, report, user/account, compliance, admin, support, eSign, twilio, error, test.

## 2. Lead and application intake

| Feature | Path | What it does | Fields / actions | Evidence |
|---|---|---|---|---|
| Add Lead | Add menu | Creates a lead-stage deal | Contact name, phone, email; lands in the Leads column | Seen (menu); form from template |
| Add Application (Quick App) | Add menu, opens `quickDeal.page.html` modal (lg) | Starts a new deal with borrowers | Borrower names/contacts, purpose, then opens the deal workspace | Template |
| Add Contact | Add menu | New contact record | Contact form fields as on the contact profile | Template |
| Add Client Experience | Add menu, opens `newClientExperience.modal.html` (md) | **Sends the client** an online application plus a document-collection portal invite | 3 tabs. Tab 1 contacts: first, last, email, language, primary flag, add/remove contact. Tab 2: template select and start-email subject. Tab 3: "use smart rules", document bundles (reset, remove, primary-only toggle), conditions (active, note, primary toggle, remove). Then **Send** | Template. **Never clicked: it emails a client** |
| Client Experience templates | User profile | Reusable CE setups and default conditions | Add template modal, default condition change, condition sections, condition notes | Template (bundle code) |
| Online application intake | Feed: "New applications" | Client-submitted apps arrive and are marked viewed | See all / Mark all as viewed; `deal/newApplications` list | Seen (feed); list Template |
| Importer | Tools > Importer | Bulk import of deals/contacts from another system's export | Upload file, map, import | Seen (page); parsing not exercised |
| API In | Docs | Inbound leads/contacts from the broker's website or apps | — | Docs |

## 3. Deal pipeline

- **Deals dashboard, card view** (`dashboard/deals/card`, Seen):
  - 10 stage columns: Leads, Pre-Approvals, New Deals, Submitted, Approved, Accepted, Waiting to Close, Funded + Awaiting Payment, Declined, Cancelled
  - Units and volume per column, collapse, View All
  - Each card shows close / follow-up / conditions / submitted dates, assignee and purpose
- **Grid view** (`dashboard/deals/grid`, Template):
  - Filters: Unassigned, No Agent, status multi-select, closing date range
  - 11 sortable columns
  - An "As:" user select for people who manage others (Inferred: managers)
- **Statuses** (Template, translation keys): new, submitted, approved, accepted, waitingToClose, complete, declined, cancelled, parked, plus the lead and pre-approval stages
  - Moving between them: Docs ("Managing Deal Statuses")
  - Exact transition rules: **unknown**
- **Parked deals** (Seen list): on standby while waiting for the client. Help says parked deals come back to the pipeline.
- **Historical deals and restore** (Seen list): older deals and imports; restore and duplicate are Docs/Template.
- **Cancel or reinstate** (Docs): deals and contacts are never deleted, only cancelled, for audit reasons.

## 4. Deal workspace (`deal/details/*`, Template plus Seen layout)

- **Header:**
  - Deal name and clients
  - Metrics: GDS %, TDS % (with a breakdown dropdown), LTV %, Net Worth, Status, Closing date, Conditions date
  - Modern / Classic view toggle
- **Actions menu** (Template; none were run):
  - Duplicate, Convert to New, Park
  - Reassign file, Assign to Me, Remove
  - Save + Validate
  - Submit to Lender, Update Lender
  - Queue for External CRM
  - Respond - Co-Broker
  - Print Application (English/French)
- **Save + Validate:** shows a panel with an error per invalid field, or "No errors" (Template).
- **Sections:** 13 collapsible sections across 8 tabs. Field lists are in `src/components/sites/velocity/deal-sections.ts` (Template).
  - Reminders, Deal Specific Tasks, Pinned Notes, Notes
  - Assets & Properties, Conditions & Documents
  - Subject Property, Mortgage Request, Borrowers
  - System Email History, Referral, Insurance, Close-Out Process
- **Submit to Lender** (Template/Docs):
  - Sends the application to a lender through a lender exchange
  - Lender responses and commitments come back to the deal ("Lender Responses" doc)
  - Resubmit and update flows: Docs
  - **External integration, not exercised**
- **Applicants** (Docs): change applicant order, borrower/guarantor role; merge separately submitted applicants into one deal.

## 5. Conditions, documents and the client portal

- Conditions lists per deal (Template); creating them is Docs ("Conditions & Documents").
- **Smart Conditions** (Docs): conditions fill in automatically from mortgage type, borrower details and similar.
- **Client portal** (Docs): clients upload from mobile; files are auto-converted to PDF and attached to the deal.
- **Document upload and download:** **never exercised**, per the user's rules.

## 6. Credit, compliance, AML

- **Credit bureau pulls** (Docs: Equifax / TransUnion):
  - The Credit Bureau report lists pulls (Seen menu; list template `creditBureauList.html`)
  - **Never pulled**
- **Compliance settings** (Seen page) and **compliance dashboard** (`compliance/dashboard`, Template):
  - Search by agent, client or loan code
  - Filter by deal status
  - Compliance status: In progress / Non-compliant / Compliant
  - "Manage compliance" modal with **Lock package**
- **Final compliance packages** (Docs).
- **AML reports** (Seen in menu, Template states):
  - Borrower Risk Assessment and Borrower Sanction Screening
  - Each has a per-agent variant and filters
- **Office AML settings:** Blocked, built from the template.

## 7. Communication

- **Notes and pinned notes, system email history:** deal tabs (Template).
- **Message Centre** (`dashboard/messageCentre`, Seen feed, list Template).
- **Connect email** (Docs): client-facing emails go out from the broker's own address.
- **SMS** (Docs "Text Directly through Velocity"; Template `twilio.connect/authorize/deauthorize`):
  - Twilio account linking
  - **Not exercised**
- **Office email domains with Azure settings** (Support, Blocked; built from the template).

## 8. Tasks, reminders, calendar, workflows

- **My Day** (Seen):
  - Four task lists: Phone, SMS, Email, Other
  - Bulk actions: Done / Send / Postpone / Re-Assign
  - Error "At least one task must be selected."
- **Reminders** (Seen feed; `deal/reminders` list).
- **Calendar** (Seen):
  - Five drag-to-add event types
  - FullCalendar month / week / day views
  - Edit Item modal
  - Google Sync (Connect, or Tasks / Closing Dates / Two Way): **external, not exercised**
- **Workflows, also called Active CRM** (Seen page; Docs): automatic check-ins with clients and referral partners.

## 9. Contacts

- **List** (Seen):
  - CASL consent filter, search, column toggle
  - Bulk CASL opt-in/out with a confirm
- **Profile** (Template):
  - Details, activity, deals, properties, assets, addresses, employment
  - Referral partners, related contacts, merge sources
  - CRM campaign switches
- **Merge** (Seen): suggestions with a pager; Auto / Custom merge.
- **Duplicates report** (`contact/duplicatesReport`, Template): duplicates and merge status.
- **Lookup by phone** (state only): Template.
- **Deletion:** contacts can't be deleted (Docs).

## 10. Reports

| Report | Evidence |
|---|---|
| Build a Report: custom fields, filters; export to a CRM audience list or CSV | Seen page; Docs |
| One-Touch reports | Seen |
| Production (list, detail, by lender, deal) | Seen menu / Template |
| No Agent Assigned (grid `?noAgent=true`) | Seen |
| Pipeline and pipeline detail | Seen |
| SLA summary and detail | Seen menu / Template |
| Credit Bureau | Seen menu / Template |
| AIR report: CSV / PDF export | Template |
| Consumed products: filters EZ Account, NOA, property validation, eSign, eSign premium; paged | Template |
| Queued for external CRM | Template |
| Compliance | Template |

## 11. Paid add-ons and external services (all Docs or Template, none exercised)

- eSign: integrated signing, with a transaction history page (`eSign/history`)
- EZ Account: down payment confirmation
- NOA: notice of assessment
- Property validation
- Credit bureaus
- AltHub: alternative-lender marketplace bidding
- VelocityCRM: templates, campaigns, audience lists
- API Out: to an external CRM
- Google Calendar, Twilio, Azure/M365 mail
- Calculators: the external mobile-app link
- Manage Subscriptions: external membership site

## 12. Admin (Blocked: no links for this user; built from templates)

- **Offices list and edit:**
  - Application settings, online/document consent (English/French), client experience, AML
  - Consent templates with acceptance, signature, page break and PDF preview
  - An office-user grid with fee splits
- **Users:**
  - List, edit: licence, credit bureau, CRM profile, income breakdown, working provinces
  - User matrix: roles, assists, is-agent
- **Organization edit:** about 56 feature toggles.
- **Lenders, lender matrix and lender detail:**
  - Fees, submission agents, underwriters, products
- **Logs:** 6 tabs, view modal.

## 13. Support (Blocked; built from templates)

- **Email domains:**
  - A status workflow that blocks Active without Azure settings
  - Status history, accounts
- **Webhooks:** list and transactions, with the JSON payload.

## 14. Help menu catalogue (Docs)

- **Data and reporting:** custom reporting, extracting reports, importing data, imported deals
- **Deal lifecycle:** cancel/reinstate, applicant order, duplicating apps, lender responses, deal statuses, merge applicants, parked deals, resubmit/update lender
- **Client documents and portal:** client experience, client portal, conditions & documents, smart conditions, homeowner's insurance condition
- **Integrations and add-ons:** connect email, credit bureaus, eSign, EZ Account, SMS, add-ons bundle, API In, API Out
- **Tasks and CRM:** My Day, workflows, VelocityCRM (templates, campaigns, audiences)
- **Compliance:** final compliance packages, remove contact
- **Other:** AltHub, FAQ

## Unknown or not inspected

- Exact status transition rules and who may make each one
- Lender submission payload and lender list
- Commission and fee calculation
- Server-side validation rules beyond what the templates show
- Notification triggers
- Permission matrix per role
- The internals of VelocityCRM and Discovery (separate apps)
- Previous Deals (skipped on purpose)
