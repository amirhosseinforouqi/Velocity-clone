# RevoDoc read-only audit notes

Structure only. No client names, numbers, emails or documents.

## Navigation
- Tools: Customer Tracking, Group Customer Tracking, Rates, Lenders, Contacts, Contact Groups
- Reports: Sales Tracking, Group Sales Tracking, Custom Reports, Group Custom Reports
- Settings: Condition Templates, User Progress Steps, Group Progress Steps, Email Templates, PDF Templates, Note Categories, Contact Sub Roles, Contact Document Templates
- Accounts: Profile, Change Password, Group Membership, Subscription

## Dashboard
- Alerts panel.
- Customer counts: Leads, PreApprovals, Approvals; Search; date filter ("Last 30...").
- Pending Emails count.
- Users panel.
- Deadlines panel: Name, Deadline, Days To, Milestone. Milestones are Lender Submit, Lender Conditions, Lawyer Instructed, Closing.
- Conditions panel: one card per deal.
  - Pre-Approval tag.
  - Next Milestone date and label (Appl Date / Lawyer Instr / Close).
  - Condition count.
  - Maintain Conditions; "+".
- Approvals list.
  - Filters:
    - Deal Status: Credit Analysis, Active, Completed, Benched, Cancelled, Declined, Audit.
    - Deal Owner.
    - Name Filter.
    - Tasked To: All / UnTasked / user.
    - Assigned To: All / None / UnAssigned / user.
  - Buttons: Add Deal, Reassign.
  - Columns: #, View, Name, Purpose, Progress step, Amount, condition counts (Required/Rejected/Satisfied), Appl Date, Lender Conditions, Lawyer Instr, Close, Days To, Milestone.
  - Unset dates show "Pending".

## Settings
- **Condition Templates**: list of Name and Availability; Add Template.
- **User / Group Progress Steps**:
  - One template per deal type: Lead, PreApproval, Approval, Purchase, Refinance, Transfer, Renewal, Builder, Construction, Development, Renovations, Equity Takedown, Other.
  - Row columns: Insert After, Show Milestone, Progress Step, Days, Todos, Auto Messages, Pre-Requisite, Add/Remove (X).
  - Each step has a todo checklist.
  - Group template steps, with example todos:
    - Created: Create Deal, Contact Lead.
    - Documents Requested: Upload Documents.
    - Package: Set Conditions, Upload Documents, Create Package, Send Documents.
    - Lender Submit: Obtained Consent, Protect Rate, Lender Submit.
    - Lender Commitment: Lender Commitment, Rate Protected.
    - Signed Commitment: Signed Commitment, Confirm To Realtor.
    - Order Appraisal: Ordered Appraisal.
    - Financing Waiver: Waived Financing.
    - Documents Outstanding.
    - Broker Conditions Met: All Conditions Met, Send Closing Checklist.
    - Branch Sign.
    - Lawyer Instructed.
    - Closing: Funded, File Audit.
    - Cash Bonus Notification.
    - Finder's Fee Received: Pay Statement.
    - Cash Bonus Paid.
    - Other Fees Paid/Received: Reimburse Expense, Revenue Received, Creditor Insurance Fee.
    - Complete.
  - The user template also has: Documents To Be Reviewed, Condition of Finance, Approval, Lender Conditions.
  - Steps seen on deals: Documents Requested, Documents To Be Reviewed, Ready for Submission, Lender Submit, Lender Conditions, Approved, Financing Waiver, Lawyer Instructed, Branch Signing, Closing.
- **Email Templates**:
  - User and Group scopes.
  - Columns: Name, Subject, Template Type (e.g. Custom Email), Attachments (Upload Files, Add Template).
  - "Data Mapping Variables - Master List".
  - Edit, X.
- **PDF Templates**: User and Group scopes; columns Name, Template Type; Add PDF Template.
- **Note Categories**:
  - Editable list with Add and Remove.
  - Seen: Lead, PreApproval, Approval, General, Admin, Follow Up, Urgent, Advisor Comment, Customer Phone Call, Customer Correspondence, Lender Correspondence, Appraiser Phone Call, Appraiser Correspondence, Legal Phone Call, Submission Notes, plus one more.
- **Contact Sub Roles**:
  - Each sub-role maps to a role.
  - Roles: Accountant, Advertisement, Appraiser, Banker, BDM, Builder, Call In, Client, Co-Agent, Co-Broker, Construction Company, Credit Admin, Creditor Insurance, Developer, Engineer, Environmental, Financial Planner, Fulfillment Officer, Home Inspector, Insurance Advisor, Investor, Lawyer, Lender, Mortgage Broker, Online, Other, Private Lender, Promo, Real Estate Agent, Referral Source, Surveyor, Underwriter, Walk In, Website.
- **Contact Document Templates**: the menu click landed on "Condition Template Management". Unverified.

## Tools
- **Lenders**: list (Bank) with Select, Remove, Add.
- **Contacts**:
  - Columns: Name, Company, Role, Sub-Role, Email, Public, Group (sortable).
  - Row actions: Edit, Copy.
  - Add Contact.
- **Contact Groups**: Group, Owner; Add Group, Edit, Copy, Remove.
- **Customer Tracking** filters:
  - Deal: All, Leads, PreApprovals, Approvals, Benched, Cancelled, Completed.
  - Purpose: Purchase, Refinance, Transfer, Renewal, Builder, Construction, Development, Renovations, Equity Takedown, Other.
  - Term Type: Closed, Open, Convertible.
  - Term: 1-25.
  - Rate Type: Fixed, Variable.
  - Client Rate ≥.
  - Residential / Commercial.
  - Date field (Created, Closing, Maturity, Aftercare) with Start and End.
  - Results not inspected because they contain client data.
- **Rates**: no page opened in this tab. Unverified.

## Reports
- **Sales Tracking Report** filters: deal status, Lender, Funded status, Mortgage type, Referrer, date range.
- **Custom Reports**: list of Label, View, X; Add Report.
  - **Add Report creates a saved row immediately** ("New Dynamic Report"). It was created by mistake during this audit; see the incident below.

- **Group Sales Tracking Report**:
  - Filters:
    - status: All, Approvals, Leads, PreApprovals, Funding Ratio, Cancelled, Benched;
    - Lender;
    - Funded: All, Not Funded, Funded;
    - Broker;
    - Mortgage type: 1st Mortgage, 2nd Mortgage, 3rd Mortgage, HELOC;
    - Referrer;
    - date range.
  - Export PDF.
- **Group Customer Tracking**: same filters as Customer Tracking, across the whole group.
- **Group Custom Reports**: the menu click landed on Group Email Templates. Unverified; probably Custom Reports for the group.

## Accounts
- **Profile**:
  - Email, First Name, Last Name, Title, Company, Phone, Fax, Timezone.
  - Address: Unit, Street Number, Street Name, Type, Direction, City, Country, Province/State, Postal/Zip.
  - Toggles: Load Condition Images; Receive reminder emails (alerts still shown when unchecked); Disable Automatic Message Alerts.
  - Store the email account password for outgoing mail. Outgoing email goes through the user's own SMTP.
- **Change Password**: New and Repeat. Rules: 4-16 characters, upper and lower case, numbers, symbols.
- **Group Membership**:
  - Group settings: Group Name, Home Page, Logo URL, SMTP Host, SMTP Port, "Create audit documents for audit (otherwise auditor views deal)", "Send reminder 6 months before term complete", Group Subscription.
  - Members: Active, Email, User Code, Name, Partner, GroupSubscr, Enabled, SuperUser, Admin, Agent.
- **Subscription**: Free (Basic), Elite Tier Annual, Elite Tier Monthly; Continue. Billing is not relevant to Keyway.

## Deal workspace (one old completed deal, read-only)
- **Header**:
  - Deal ID.
  - Purpose (same list as Customer Tracking).
  - Program (blank plus 30 options): Bad Credit, Bridge Loan, Business Loan, Commercial Mortgage, Construction Loan, Consumer Proposal Payout, Debt Consolidation Payout, Equity Takeout, First Time Buyer, HELOC, Equity Program, Home Improvement Mortgage, Legal Action, Mortgage Renewal, Networth Program, New To Canada, Non Resident, Other, Refinance Mortgage, Rental, Repeat Buyer, Reverse Mortgage, RTO (Rent to Own), Second Home, Second Mortgage, Self Employed, Spousal Buyout, Stop Foreclosure, Stop Power Of Sales, Third Mortgage.
  - Type: Lead, PreApproval, Approval.
  - Referral: picks from the Contacts list, with Add.
  - Owner.
  - Buttons: Application, Cancel, Return.
- **Customer panel**: Applicant 1 with phone and email; Edit.
- **Member Access**: the list of users who can see the deal; Select.
- **Scheduled Deadline Dates**:
  - Fields: Lender Submit, Lender Conditions, Lawyer Instructed, Closing.
  - "Progress Step: <step>"; Send Message.
- **Progress panel**:
  - Settings, Details.
  - The deal's own step list. Each step has a check mark and a date picker; Created shows the creation date.
- **Deal Tracking tabs**: Mortgage, Docs, Notes, Sent, Emails, Contacts, Reminders, Activity, After Care; Expand.
  - **Mortgage**:
    - File numbers: Broker File #, Origination File #.
    - Position: select 1st/2nd/…; Add Mortgage.
    - New Loan / Renewal; Prime / Sub-Prime.
    - Lender, Lender Ref #.
    - BDM, Underwriter, Credit Admin: contacts chosen by sub-role, with Add.
    - Mortgage Amount.
    - Amortization in years (0-50) and months (0-11); Schedule.
    - Term; Rate (Fixed/Variable); Choose / Manual / Details.
    - Buy Down %; Client Rate.
    - Payment Frequency: Monthly, Semi-monthly, Bi-weekly, Accelerated biweekly, Weekly, Accelerated weekly, Annually, Bi-Annually, Quarterly.
    - Payment (computed); Payment Date; Maturity Date.
    - Protected Rate: Hold days and Expiry Date.
    - Lender Commitment date.
    - Compensation: Finders Fee, Volume Bonus, Buydown Cost, Paid To Brokerage; Add Revenue; Fee Split %; Paid To Agent.
    - Creditor Insurance: Life, Disability; Add Expense.
    - Net per mortgage; Total.
  - **Docs**: Expand All; rows per condition/document (e.g. Down Payment); Send Reminder per row and overall; Upload Files; Create Package.
  - **Notes**: Add Note; Category filter (All Categories); text filter; Table View.
  - **Sent** and **Emails**: empty on this deal. Columns unverified.
  - **Contacts**: Add Deal Contact, Add Broker Contact; table of linked contacts.
  - **Reminders**: Add Reminder; table with a per-row Progress dropdown, which ties the reminder to a progress step.
  - **Activity**: a read-only log of date, user and action (e.g. Deal viewed, Reminder Sent).
  - **After Care**: recurring client-touch schedule. Columns: Label, Next Date, Period, MaximumTimesSent, ConfirmBeforeSending, Receivers, Disable.

## Incident
On 2026-10-30, clicking "Add Report" on Custom Reports created a blank report named "New Dynamic Report" in the live account. Nothing was entered or deleted. The user is deleting it themselves. From here on, ask before pressing any Add/New button in RevoDoc.

## Not yet inspected
Unverified:
- Rates.
- Contact Document Templates.
- Group Custom Reports.
- Sent and Emails tab columns.
- Progress "Details" and "Settings" dialogs.
- The Application button (it likely opens the full application form).
- Customer Tracking results.

Each of these needs either a click that may open an editor or a page that shows client data.
