# Application Workspace

Route: `/deal/{id}/{tab}`. Code: `src/components/platform/deal.tsx`, `deal-sections.ts`, `deal-portal.tsx`,
`src/app/deal/[id]/workspace.tsx`.

## Header

Name, file number, phone, email, co-applicants; chips for application type, stage and portal status.
Actions: Edit Client, Upload Document, Send Message, Invite Client, Change Stage, More Actions (Save + Validate,
Duplicate, Assign to Me, Print En/Fr, Delete). Agent and assistant selectors, GDS / TDS / LTV, closing /
conditions / lawyer dates, document summary, next action. The tab bar and Save button stay visible while scrolling.

## Tabs

| Tab | Contents |
|---|---|
| Client & Applicants | Lead & CRM (stage, source), applicants 1–4, referral, file contacts |
| Employment & Income | Primary employment, Employment 2–4, Other Income 1–4 |
| Assets & Liabilities | Totals, Asset 1–8, Liability 1–10, other properties |
| Property & Mortgage | Subject property, mortgage request, rates, qualifying details, insurance; Business Loan group when the program is Business Loan |
| Documents | Client checklist (request, remind, upload for client, review, accept, request replacement, cancel), lender conditions, compliance, AML |
| Messages | Portal access, secure messages, internal staff notes |
| Lender & Stage | Progress steps, what the client sees, close-out, aftercare, stage history |
| Tasks & Follow-ups | Reminders and tasks |
| Activity History | Audit trail for the file |

## Editing

- All tabs are one form; Save stores everything and reports "Saved" or the validation problems, with links that
  jump to the field.
- Repeated entries: "Add an employment", "Add other income", "Add an asset", "Add a liability". Remove asks for
  confirmation, can be undone until Save, and the old values stay in the audit trail.
- Dropdown lists (lead stage, lead source) come from organization settings.

## Calculations

`src/server/metrics.ts` — working defaults, **not lender rules**:
- Income: primary employment plus current additional employments plus other income, converted to monthly.
- Debts: monthly payments on listed liabilities; skipped if paid off at closing; credit cards and lines of credit
  with no payment entered count 3% of balance (the percentage is an organization setting).
- Mortgage: first/second/third mortgage totals, else total with premium, else loan amount, else price less down payment.
- Qualifying rate: entered value, else the greater of contract + buffer and the floor. Buffer (2%) and floor
  (5.25%) are organization settings: Admin → Organization → Qualifying Defaults.
- Total Assets, Total Liabilities and Net Worth are calculated from the entries, update as you type, and are read-only.
- Value: lower of purchase price and appraisal, else estimate.

Calculators (top bar) start from the open file's price, down payment, loan amount, rate and amortization;
changing them does not alter the file.

## Sensitive fields

SIN: must be 9 digits, encrypted with AES-256-GCM before storage, returned to the browser masked, never written
to the audit trail, masked on the printed application.

## Fields not claimed

Field names follow common Canadian mortgage-application practice. No proprietary REVO, Velocity or Filogix
layouts, field lists or APIs were copied or reproduced.
