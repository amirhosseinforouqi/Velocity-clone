# Velocity route map

Taken read-only from the app's ui-router state table (112 states). The table holds no client data.
Hash routes sit under `/RMAI0001DealManagement/SPA/#/`.

## Clone status

| Area | Velocity route | Clone route | Status |
|---|---|---|---|
| Home dashboard | `dashboard/home` | `/` | Built |
| Deals dashboard, card view | `dashboard/deals/card` | `/dashboard/deals` | Built |
| Deals dashboard, grid view | `dashboard/deals/grid` | `/dashboard/deals/grid` | Built |
| Deal workspace, full page | `deal/details/full` | `/deal` | Built |
| Deal workspace, 8 tabs | `deal/details/<tab>` | `/deal/<tab>` | Built |
| My Day | `myDay` | `/my-day` | Built |
| Calendar | `calendar/view` | `/calendar` | Built |
| Contacts list | `contact/list` | `/contacts` | Built |
| Contact profile | `contact/details/:id` | `/contacts/<id>` | Built |
| Merge contacts | `contact/merge` | `/contacts/merge` | Built |
| Sidebar submenus (Contacts, Reports, Tools) | — | shell | Built |
| Add menu (Deal, Contact, Lead, Quick App) | — | shell modals | Built |
| Historical / restore / parked deals | `deal/historical`, `deal/historicalRestore`, `deal/parked` | `/deals/historical`, `/deals/historical/restore`, `/deals/parked` | Built |
| New applications, reminders | `deal/newApplications`, `deal/reminders` | `/deals/new-applications`, `/deals/reminders` | Built |
| Reports (8) | `reports/*` | `/reports/<slug>` | Built |
| Message Centre | `dashboard/messageCentre` | `/messages` | Built |
| Global search | `globalSearchResults` | `/search` | Built |
| Importer | `importer` | `/tools/importer` | Built (xlsx parsing not modelled) |
| Calculators, Help, top bar feeds, Me menu | — | shell | Built |
| User settings, profile | `user/settings`, `user/profile` | `/user/settings`, `/user/profile` | Built |
| Compliance settings | `account/settings/compliance` | `/account/settings/compliance` | Built |
| Workflows | `workflows` | `/workflows` | Built |
| Offices, office edit (consent templates) | `admin/office/list`, `office.edit` | `/admin/office/list`, `/admin/office/edit/<id\|new>` | Built |
| Users, edit user, user matrix | `users`, `editUser`, `office.user-edit`, `userMatrix` | `/admin/users`, `/admin/users/edit/<id\|new>`, `/admin/user-matrix` | Built |
| Organization edit, offices | `organization.edit`, `organization.offices` | `/admin/organization/edit`, `/admin/organization/offices` | Built |
| Lenders, lender matrix, lender detail | `lenders`, `lenderMatrix`, `lenderDetail` (+ product, underwriter) | `/admin/lenders`, `/admin/lender-matrix`, `/admin/lenders/<id>` | Built (product and underwriter as modals) |
| Logs | `logs` | `/admin/logs` | Built |
| Email domains | `support.emailConfig.domains` | `/support/email-configuration/domains` | Built |
| Webhooks, transactions | `support.webhook.list`, `.transactions` | `/support/webhook/list`, `/support/webhook/transactions/<key>` | Built |
| AML detail, eSign history | see below | — | Not built |

## Main
- `dashboard/home`, `dashboard/deals/card`, `dashboard/deals/grid` (`?noAgent=true` = "No Agent Assigned" report), `dashboard/messageCentre`
- `contact/list`, `contact/details/:id`, contact by phone, `contact/merge`, `contact/duplicatesReport`
- `myDay`, `workflows`, `calendar/view`, `importer`, `globalSearchResults`, `eSignHistory`

## Deal
- `deal/details/full` with tabs: borrowers, assetsProperties, communicationHistory, conditionsAndDocuments, insurance, mortgageRequests, referrals, remindersAndTasks
- `deal/parked`, `deal/historical`, `deal/historicalRestore`, `deal/newApplications`, `deal/reminders`

## Reports
- production (list, detail, byLender, deal), pipeline and pipeline detail, oneTouch, build, SLA (summary, detail)
- creditBureau, air, compliance, consumedProducts, queuedExternalCrm
- AML: borrowerRisk, borrowerRiskAgent, borrowerSanctionScreening, borrowerSanctionScreeningAgent

## Account and user
- `compliance/dashboard`, `account/settings/compliance`, `user/settings`, `user/profile`

## Support
- emailConfig domains, webhook list, webhook transactions

## Admin
- office list, office edit, office user edit, lenders, lenderMatrix, lenderDetail, productDetail, underwriterDetail, logs, users, editUser, userMatrix, organization (edit, offices, officeEdit)

## Other
- `error/notFound`, `account/expired`
- Separate apps, not part of this SPA: VelocityCRM, VelocityDiscovery, VelocityBeta

## Menus
- **Sidebar:** Add, Home, Dashboard, Contacts (List, Merge Contacts), My Day, VelocityCRM, Reports, Calendar, current Deal, Previous Deals, Discovery, Tools (Importer), Historical Deals, Parked Deals
- **Reports:** Build a Report, One-Touch, Production, No Agent Assigned, Pipeline, SLA, Credit Bureau, Borrower Risk Assessment, Borrower Sanction Screening
- **Me:** Settings, Profile, Compliance Settings, Workflows, Manage Subscriptions, MPP Hub, Velocity3 Beta, Log Out
- **Top bar dropdowns:** new applications, messages, reminders (each with a "See all" link), Help (training articles)

## Deals dashboard, card view (measured)
- Header: laptop icon, "Deals Dashboard" (28px, weight 300, #666), breadcrumb "Home > Deals Dashboard". Content background #f1f1f1.
- 10 stage columns, 310px wide with 30px gaps, scrolling horizontally. Column: white, 2px radius, shadow `0 1px 4px rgba(0,0,0,.1)`. Header 50px with a collapse chevron, then "Units: N Volume: $N" (12px #666). Body padding 15px 20px.
- Stage colours: Leads #d9534f, Pre-Approvals #001f3f, New Deals #00c0ef, Submitted #3c8dbc, Approved #f39c12, Accepted #39cccc, Waiting to Close #3d9970, Funded + Awaiting Payment #00a65a, Declined #eaeaec (text #666), Cancelled white (red title).
- Deal card, 270px: blue header link (#0073b7, 12.6px, radius 4px 4px 0 0) with the deal name and an external-link icon; Leads open in a new tab. Rows are 12px #666 on white, 1px #ddd borders, each with a right-aligned uppercase badge (10px): CLOSE DATE (#d9534f), FOLLOWUP, CONDITIONS DATE, SUBMITTED DATE, ASSIGNED (#5bc0de), PURPOSE (#5bc0de). 20px between cards.

## Deals dashboard, grid view (from template, no client data)
- Header: cogs icon, "Dashboard - Grid", optional "As:" user select (22px, weight 300), breadcrumb. Card `.grid` like the stage columns; its header has an align-left icon, the title and a blue "Dashboard - Cards" button.
- Filters: Unassigned, No Agent, Status multi-select ("Click here to add status"), Start/End Closing Date (MMM-dd-yyyy, 1.5s debounce).
- Table `table-striped amended-tables`: fixed layout, min-width 900px, head rgba(0,0,0,.6) white with #797979 borders, rows white/#fafafa with #ddd borders, ellipsis cells. 11 sortable columns: Name, Loan Code, Status, Submitted, Purpose, Closing, Conditions, Lender, Product, Net Rate, Associate. Dates "MMM dd, yyyy". Leads show no loan code link. Empty: "No deals found."
- Entry points: each card column's "View All" (`?status=<stage>`), and Reports > No Agent Assigned (`?noAgent=true`).

## Deal workspace (from templates, no client data)
- Route `main.deal.details` (params loanCode, id, open, classic). The full page is a sticky header plus 13 collapsible sections, all collapsed at load. Each tab route shows only its sections.
- Section order: Reminders, Deal Specific Tasks, Pinned Notes, Notes, Assets & Properties, Conditions & Documents, Subject Property Details, Mortgage Request, Borrowers, System Email History, Referral, Insurance, Close-Out Process.
- Tabs: borrowers, assetsProperties, communicationHistory (pinned notes, notes, email history), conditionsAndDocuments, insurance, mortgageRequests (subject property, mortgage request), referrals, remindersAndTasks. Reached from the sidebar "Deal:" submenu.
- Header `.deal-overview`: #58595b, radius 3px. "View: Modern | Classic" toggle (links padded 5px 15px, border #ebebeb, active #428bca). "Actions" dropdown (`.btn.new-blue`, gradient #428bcd→#3d81be): Duplicate, Convert to New, Park, Reassign file, Assign to Me, Remove, Save + Validate, Submit to Lender, Update Lender, Queue for External CRM, Respond - Co-Broker, Print Application (En/Fr).
- `ul.deal-details`: white gradient, flex row. First li #373839, 60px, white icon 2em. `li.deal` 30%, border-right #d7d7d7, padding 5px 15px, h2 1.4em weight 500. `li.clients` border-left white, padding 5px 15px.
- Metrics row: GDS %, TDS % (breakdown dropdown), LTV %, Net Worth, Status, Closing date, Conditions date. Save + Validate shows a validation panel (alert-danger per error, or "No errors").
- Field lists per section are in `src/components/sites/velocity/deal-sections.ts`.

## My Day (from template, no client data)
- Header: sun-cloud icon, "MY DAY", breadcrumb "YOUR WORKFLOW TASKS FOR THE DAY". Day pager: 37px angle arrows, day 41px weight 500, month 15px uppercase with bold weekday. Right: blue "Review your VelocityCRM tasks" link (CRM subscribers only).
- Empty state: "You have no tasks today." 14px #428bca on white, shadow `0 0 4px rgba(0,0,0,.1)`.
- Four collapsible lists: Phone Calls, SMS, Email, Other. Heading #428bca 1.5em, body #f1f1f1. Bulk select (Mark as Done, or Send for SMS/Email; Postpone; Re-Assign) plus Apply; error "At least one task must be selected."
- Table head rgba(0,0,0,.6): Title, Deal #, Status, Recipients, # to Call / # to SMS / E-mail Address, Script (View), Actions (To do #5cb85c | Done #d9534f, dropdown Edit, Postpone, Re-Assign, Remove).

## Calendar (from template and CSS, no event content)
- Left: "Drag to Add" (Phone call #006596, Email #2c4e86, Followup #5a98cd, Appointment #64ab23, Personal #68468f) and "Google Sync" (Connect, or Tasks / Closing Dates / Two Way with Sync and Clear).
- Right: "Agenda" FullCalendar, month/week/day, height 925. Buttons #2c3e50 (active #1a252f), 12.6px; title 22px weight 300 #666; day headers and numbers #428bca; today rgba(255,220,40,.15); borders #ddd; month cells about 139px.
- Timed events read "10:00a Title". Dropping a type creates an event named after it and opens "Edit Item" (All day, Start, End, Title, Location, Phone, Email, Description, TODO, Send E-mail, deal accordion, Delete with confirm, Close).

## Contacts (from templates, no client data)
- List: address-book icon, "Contacts". Panel heading has "CASL Status:" (Any, Opted In, Opted Out), "Search your Contacts..." with a clear button, and "Toggle Columns" (First/Last Name locked). Table: merge caret (shows merged child rows), "CASL Opt In" header dropdown (Opt in / Opt out all, then "Are you sure? You are about to OptIn ALL Contacts" with Confirm/Cancel), sortable First/Last Name, phones, email, current and two previous addresses, open button. Empty: "No contacts found".
- Profile: breadcrumb Home > Contacts > Contact Profile, "Actions" dropdown (Quick Application). Collapsible panels: Contact Details (duplicate alert with Merge, the contact form, Activity tabs Email / SMS / Phone Call / Appointment / Other), Deals, Properties, Assets, Addresses, Employment, Referral Partners, Related Contacts, Merge Sources, Manage CRM Campaigns (four switches).
- Merge: "Merge Suggestions N of M" with a name select and pager; Auto Merge (green), Custom Merge (blue), Add; Toggle Columns; checkbox table of First Name, Last Name, Cell Phone, Email.
