# Integration Architecture

## Single source of truth

```
Client (contact) ──< File (deal) ──┬─ application fields (deal.fields)
                                   ├─ document requests ──< versions (files)
                                   ├─ conversations ──< messages
                                   ├─ staff notes, tasks, reminders
                                   ├─ lender conditions, compliance
                                   ├─ status history
                                   └─ audit log
```

Every screen reads the same records: the workspace, the Pipeline, Messages, My Day, reports, the printed
application and the client portal. There are no copies to keep in sync.

## Module connections (all tested locally)

| From | To | How |
|---|---|---|
| New Lead | Workspace, Pipeline | Creates client + file; file appears under Leads |
| Application type + employment | Document checklist | `doc-rules.ts` picks default requests |
| Workspace fields | Header ratios, calculators, print | `metrics.ts`, calculators read the open file |
| Portal upload | Workspace Documents tab | Same document-request records |
| Staff message | Portal inbox | Same conversation records |
| Change Stage | Pipeline, Stage History, audit | `moveDeal` is the only status path |

## External integrations

| Integration | State | Behaviour when absent |
|---|---|---|
| Email (Resend) | Works only if `RESEND_API_KEY` and `EMAIL_FROM` are set. **Not set in this environment; not tested with real delivery.** | Status "not configured"; nothing is sent; the setup link is shown once to staff |
| Microsoft 365 mail / calendar (Graph) | Not built | Not offered |
| OneDrive / SharePoint | Not built | No sync indicator is shown |
| Lender submission (Velocity, Filogix, lender portals) | Not built | Menu items are disabled and labelled "Not built yet" |
| Credit bureau, sanction screening | Not built | AML screen says checks are recorded manually |
| Virus scanning | Hook exists (`MALWARE_SCAN_URL`), no service configured, untested | Client uploads are quarantined until an admin releases them; lender-condition uploads are not scanned and the screen says so |

To add Microsoft later: register an Entra app, store tokens encrypted (the `sealSecret` helper already exists),
add a mail provider next to Resend in `src/server/email.ts`, and store only message metadata, not bodies.

## Security boundaries

- Staff and client sign-ins are separate; a client session cannot open staff pages.
- Every server action re-checks scope (`scope`, `dealScope`, `contactScope`).
- Invitation links are one-time and expire; passwords are never emailed.
- Notification emails never contain message text, SINs or documents.
- Deletes are soft; changes are audited.
