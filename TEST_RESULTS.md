# Test Results

Date: 2026-11-14. Environment: local development server, local PGlite database, synthetic data only.
No real email was sent (email is not configured). Only tests that were actually run are listed.

## Automated

| Command | Result |
|---|---|
| `npm run lint` | Pass, no warnings |
| `npm run typecheck` | Pass |
| `npm test` | 86 of 86 pass |
| `npm run build` | Pass |

New tests in this work: ratios with co-applicant/other income and liabilities; mortgage fallback to price less
down payment; SIN is encrypted, masked and kept out of the audit trail.

## Acceptance scenario (browser, signed in as the seeded agent)

| # | Step | Result |
|---|---|---|
| 1 | New Lead → John Smith, john@example.com, 416-555-0100, Purchase, Employed → Create Lead Only | Pass. File KW-100166 created; phone auto-formatted; no email |
| 2 | Workspace opens with name, email, phone, type, stage, agent on top; sections below; no reminders dashboard | Pass. Chips: Purchase · Lead · New Lead · Not invited to portal |
| 3 | Employment & Income: employer, income, second employment, other income → Save → reload | Pass. All values persisted |
| 4 | Assets & Liabilities: one asset, two liabilities → Save → reload | Pass. All values persisted |
| 5 | Property & Mortgage: price 650,000, down 130,000, 4.79%, 25 years, taxes, heat → Save | Pass after a fix. GDS 42.96%, TDS 48.37%, LTV 80.00% |
| 6 | Documents shows the default employed-purchase checklist | Pass. 10 requests |
| 7 | Add a document request ("Gift Letter"); cancel one ("Equifax Credit Report") with confirmation | Pass. Count 10 → 11 → 10 |
| 8 | Invite Client → email preview → Confirm | Pass. Dialog states email isn't set up and nothing will be sent; chip "Invitation prepared — not emailed"; one-time link shown once |
| 9 | Client opens the setup link, chooses a password, lands in the portal | Pass. Chip becomes "Portal account activated" |
| 10 | Client uploads a synthetic PDF | Pass. Staff see "9 missing · 1 to review" in the same file |
| 11 | Signed-in client opens the staff file URL | Pass. Redirected to their own portal |
| 12 | Staff accept the document | Pass. "9 missing · 0 to review · 1 accepted" |
| 13 | Staff send a secure message | Pass. Appears in the file's Messages tab |
| 14 | Change Stage → Pre-Approvals | Pass. Header updates; Pipeline shows John Smith under Pre-Approvals; Stage History records it |
| 15 | Purchase Calculator opened from the file | Pass. Pre-filled 650,000 / 20% / 4.79% / 25 years |
| 16 | Legacy URL `/deal/{id}/clientPortal` | Pass. Opens the Messages tab |
| 17 | Enter a SIN, save, reload | Pass. Field shows masked value; full number not in the page or the activity list |
| 18 | Browser console | No errors |

## Follow-up round (browser, synthetic data, no email sent)

| # | Check | Result |
|---|---|---|
| 19 | Signed in as agent: Admin menu | Pass. Not shown |
| 20 | New Lead, Refinance + Self-employed | Pass. KW-100199, 12-item checklist, first-contact task created |
| 21 | New Lead, Business Loan + Self-employed | Pass. KW-100200, 12-item business checklist, first-contact task |
| 22 | Co-applicant added as Applicant 2 (spouse) → Save → reload | Pass. Persisted |
| 23 | Lender conditions: add custom, add from library, set status Met | Pass |
| 24 | Drop a synthetic PDF on a lender condition | Pass. File attached |
| 25 | Drop a synthetic PDF on "Upload for client" in the checklist | Pass. "1 to review" |
| 26 | Assets 80,000 + 5,000, liability 12,000 | Pass. Totals 85,000 / 12,000, net worth 73,000, live and after save |
| 27 | Price 600,000, down 120,000, no mortgage amount | Pass. LTV 80.00%; Pipeline Leads volume $480,000 |
| 28 | Calendar | Pass. Closing, conditions and follow-up chips and the first-contact task appear |
| 29 | Invite Client with email not configured | Pass. Says nothing was sent; link shown once; client set own password and landed on their application |
| 30 | Staff message seen in portal; client reply appears in the portal thread | Pass. Staff-side view of the reply checked in the third pass |
| 31 | Portal with one applicant | Pass. No "Shared with your co-applicant" |
| 32 | Client A's session requests client B's application | Pass. 404 |
| 33 | Admin changes stress buffer 2 → 3 | Pass. Qualifying rate 6.79% → 7.79%, GDS 42.96% → 46.40%, TDS 48.37% → 51.82%; restored to 2 and figures returned |
| 34 | 375px width: portal application, Pipeline, workspace, Calendar, My Day, Contacts | Pass. No horizontal overflow |
| 35 | App framed by another page | Pass. Refused (X-Frame-Options) |

After upgrading `next` to 16.4.6: `npm run check` passes (85 of 85 tests, build clean); Pipeline, the workspace
(totals still $73,000 net worth) and the Calendar load with every request returning 200. One "aborted" log line
appeared while the first page was still compiling and the test navigated away; it did not recur.

## Bug audit (2026-11-14/15, local, synthetic data)

| Check | Result |
|---|---|
| 89 pages and exports requested as administrator, including bad IDs, unknown tabs and garbage query strings | No server errors; bad addresses return a clean 404 |
| 48 pages requested as agent, including three files with every tab | No server errors; admin pages return 404 as intended |
| About 20,000 calls to the server functions with hostile input (bad IDs, empty and 5,000-character text, wrong types, bad dates, script and SQL-looking text) against an in-memory database | No data was changed wrongly. Six defects found and fixed (below). Remaining hits are wrong-typed calls the screens cannot make |
| Lint, typecheck, 85 of 85 tests, production build | Pass |

Fixed in this audit:
- New lead with very long first and last names: the lead was created, then the first-contact task failed, so the
  screen showed an error and a retry would have made a duplicate. The task title is now cut to fit.
- "Calculated Payment" was blank on early files with only a price and down payment; it now uses price less down
  payment, as the header ratios already did.
- Turning portal access off with a malformed applicant ID, resetting an unknown email template, assigning with
  an empty user ID, marking a malformed after-care ID done, and signing in with a NUL character in the email all
  raised a raw database error instead of a clear refusal. Each now refuses cleanly.

### Second pass (2026-11-15): the parts the first pass left out

| Check | Result |
|---|---|
| 48 pages requested as assistant, including three files with every tab | No server errors; admin pages return 404 |
| Signed in as a synthetic client (invited on KW-100200, email not configured so nothing was sent): own application, profile, another client's application, malformed and unknown application IDs, garbage query string | Own pages load; every other application returns 404; no other client's data in any response |
| Same client requests 15 staff pages and exports | **Defect found and fixed** (below). After the fix every staff page sends the client back to their portal |
| Same client requests another file's download address, and malformed and unknown file IDs | 404 |
| 2,268 calls to the portal's server functions as client A with hostile input and with client B's deal, file, document-request, conversation and profile IDs | Every call with B's IDs refused; B's messages, files, requests and contact record unchanged. **One defect found and fixed** (below) |
| Staff sign-in and staff pages after the fix | Unchanged: pages load, admin pages still 404 for an agent |
| Lint, typecheck, 85 of 85 tests, production build | Pass |

Fixed in the second pass:
- A signed-in client who typed the address of Message Centre, User Profile, User Settings or the Importer was shown
  the staff menu and that screen. These four screens load no client or deal data, so nothing was exposed, but a
  client should never see them. Clients are now turned back to their portal before any staff page is served.
- A message or any other text field containing a NUL character raised a raw database error. The character is now
  dropped by the shared text check.

Looked at and deliberately left: a hand-crafted request that sends nothing at all where a form's contents belong
gets a generic error. The screens cannot send this, nothing is changed or revealed, and hiding that class of
error would also hide real faults.

### Third pass (2026-11-15): the two untested flows and three security fixes

| Check | Result |
|---|---|
| Staff open the Messages tab of KW-100199 after the client replied in the portal | Pass. The reply shows under the staff message with the client's name; the unread badge clears on opening |
| New two-applicant file KW-100232; one message to the primary applicant only, one to both | Pass. Email not configured, so the dialogs said nothing was sent |
| Co-applicant invited, opens the one-time link, sets a password, signs in | Pass. Lands on their own application; the 10 requests are labelled "Shared with your co-applicant" |
| Co-applicant's view of messages and profile | Pass. Sees the shared thread; the thread sent only to the primary applicant is absent from the page; profile shows their own details |
| Co-applicant: wrong password, another client's application, a staff page | Pass. Refused; 404; sent back to the portal |
| Response headers | Pass. HSTS, Permissions-Policy, report-only CSP, X-Frame-Options present; no CSP reports in the console on the sign-in and file pages |
| Sign-in after the lockout moved to the database | Pass. Wrong password refused, right password signs in. Five wrong attempts lock the account even for the right password until the window passes (automated test) |
| Lender-condition upload flagged by a scanner | Pass (automated test with a stand-in scanner). Refused and not saved. No real scanner is connected |
| Lint, typecheck, 86 of 86 tests, production build | Pass |

Still not covered, because it cannot be done from this machine without your accounts and approval: the production
site and its Supabase database, real email delivery, and browsers other than the built-in Chromium one.

Test data left in the local development database: leads KW-100199, KW-100200 and KW-100232 and three synthetic
portal accounts (on KW-100199, KW-100200 and the co-applicant on KW-100232).

## Defects found during testing and fixed

- Ratios stayed blank when only price, down payment and loan amount were entered → mortgage amount now falls back.
- Button read "Add an other income" → "Add other income".
- "Send new password" actually sends a reset link → renamed "Send password reset link".
- Every save logged three unchanged dates in the audit trail → only changed dates are logged.
- Calculators ignored the open file → now start from its figures.
- A hint pointed to a tab name that no longer exists → corrected.

## Not tested

- Real email delivery, bounces, "Invitation sent / Delivery failed" (no provider configured).
- Microsoft 365, OneDrive/SharePoint, lender submission, credit bureau, sanction screening, a real virus scanner (none connected).
- The content security policy in enforcing mode, and the new headers and database lockout on the hosted site.
- Screen readers, other browsers, real phones (mobile was checked by viewport width only).
- Supabase/Postgres production database, concurrent users, load.
- Screenshots: the preview pane could not capture images during this run; checks were made by reading the page.
