import { boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// SLA targets, reminder thresholds and feature flags; defaults and validation live in admin.ts.
export type OrgSettings = { sla: Record<string, number>; reminders: { urgent: number; warning: number; notice: number }; features: string[] };

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  settings: jsonb("settings").$type<Partial<OrgSettings>>().notNull().default({}),
  // Client portal settings (portal-admin.ts). Retention null = keep everything. require_staff_mfa: staff must enrol TOTP.
  inviteExpiryDays: integer("invite_expiry_days").notNull().default(7),
  retentionDays: integer("retention_days"),
  requireStaffMfa: boolean("require_staff_mfa").notNull().default(false),
  createdAt: createdAt(),
});

export const offices = pgTable("offices", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  // Address, contact and consent-text fields from the Office Edit screen; whitelisted keys only (admin-fields.ts).
  details: jsonb("details").$type<Record<string, string>>().notNull().default({}),
  createdAt: createdAt(),
});

export const role = pgEnum("role", ["org_admin", "office_admin", "agent", "assistant"]);

export const users = pgTable("users", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  officeId: uuid("office_id").notNull().references(() => offices.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // TOTP MFA (mfa.ts). The secret is AES-GCM encrypted with AUTH_SECRET; enabled once the first code is confirmed.
  totpSecret: text("totp_secret"),
  mfaEnabledAt: timestamp("mfa_enabled_at", { withTimezone: true }),
  role: role("role").notNull(),
  // Licence, profile and income fields from the Edit User screen; whitelisted keys only (admin-fields.ts).
  details: jsonb("details").$type<Record<string, string>>().notNull().default({}),
  // Deactivated users can't sign in and drop out of assignee lists; their deals show under No Agent until reassigned.
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const contacts = pgTable("contacts", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  officeId: uuid("office_id").notNull().references(() => offices.id),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  homePhone: text("home_phone"),
  cellPhone: text("cell_phone"),
  workPhone: text("work_phone"),
  address: text("address"),
  casl: boolean("casl").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("contacts_scope_idx").on(t.organizationId, t.officeId, t.ownerId)]);

// CASL consent history: one row per opt-in / opt-out, never updated.
export const contactConsents = pgTable("contact_consents", {
  id: id(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  optedIn: boolean("opted_in").notNull(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  at: createdAt(),
});

// Append-only. Written in the same transaction as the change it records.
export const auditLog = pgTable("audit_log", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  // Exactly one of the two: a staff member or a portal client.
  actorId: uuid("actor_id").references(() => users.id),
  actorClientId: uuid("actor_client_id").references(() => clients.id),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  at: createdAt(),
}, (t) => [index("audit_entity_idx").on(t.entity, t.entityId)]);

// Board stages in order, then the off-board ones. Allowed moves live in deal-status.ts.
export const dealStatus = pgEnum("deal_status", [
  "lead", "pre_approval", "new_deal", "submitted", "approved", "accepted", "waiting_to_close", "funded",
  "declined", "cancelled", "parked", "complete",
]);

export const complianceStatus = pgEnum("compliance_status", ["in_progress", "non_compliant", "compliant"]);

export const deals = pgTable("deals", {
  id: id(),
  // Shown as KW-<number>; one sequence for the whole database.
  number: integer("number").notNull().unique().generatedAlwaysAsIdentity({ startWith: 100001 }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  officeId: uuid("office_id").notNull().references(() => offices.id),
  agentId: uuid("agent_id").notNull().references(() => users.id),
  status: dealStatus("status").notNull(),
  // Where park / cancel came from, so reinstate can put it back.
  previousStatus: dealStatus("previous_status"),
  purpose: text("purpose"),
  amount: integer("amount"), // whole dollars
  closingDate: date("closing_date"),
  conditionsDate: date("conditions_date"),
  followUpDate: date("follow_up_date"),
  submittedDate: date("submitted_date"),
  // Workspace fields keyed "section/group/label" (see deal-sections.ts); only whitelisted keys are stored.
  // ponytail: one JSON column; promote a field to its own column once reports need to filter or sum it.
  fields: jsonb("fields").$type<Record<string, string>>().notNull().default({}),
  // Set by compliance reviewers (compliance.ts). A locked package freezes the conditions and documents.
  complianceStatus: complianceStatus("compliance_status").notNull().default("in_progress"),
  packageLockedAt: timestamp("package_locked_at", { withTimezone: true }),
  // The team member working the file besides the agent; sees it like the agent does (access.ts).
  assigneeId: uuid("assignee_id").references(() => users.id),
  // The client-facing progress stage; separate from the internal status above.
  clientStageId: uuid("client_stage_id").references(() => progressStages.id),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("deals_scope_idx").on(t.organizationId, t.officeId, t.agentId)]);

export const dealBorrowers = pgTable("deal_borrowers", {
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  position: integer("position").notNull(), // 0 = primary
  // Granted when this applicant accepts a portal invitation for this deal; revoking it closes their portal view.
  portalAccess: boolean("portal_access").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.dealId, t.contactId] })]);

// One row per status change, never updated.
export const dealStatusHistory = pgTable("deal_status_history", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  from: dealStatus("from"),
  to: dealStatus("to").notNull(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  at: createdAt(),
}, (t) => [index("deal_status_history_deal_idx").on(t.dealId)]);

// The organization's condition library. `rule` is the smart rule: field key -> accepted values, all must match;
// an empty rule applies to every deal past the lead stage. ponytail: AND of exact matches only; add OR / ranges when a template needs them.
export const conditionTemplates = pgTable("condition_templates", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  rule: jsonb("rule").$type<Record<string, string[]>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const conditionStatus = pgEnum("condition_status", ["outstanding", "received", "met", "waived"]);

// A deal's checklist. Never deleted (waive instead), so smart rules don't re-add what someone removed.
export const dealConditions = pgTable("deal_conditions", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  templateId: uuid("template_id").references(() => conditionTemplates.id),
  name: text("name").notNull(),
  status: conditionStatus("status").notNull().default("outstanding"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("deal_conditions_deal_idx").on(t.dealId), uniqueIndex("deal_conditions_template_uq").on(t.dealId, t.templateId)]);

// File metadata; the bytes live in storage under the document id (storage.ts).
export const documents = pgTable("documents", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  conditionId: uuid("condition_id").notNull().references(() => dealConditions.id),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  createdAt: createdAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("documents_condition_idx").on(t.conditionId)]);

export const taskType = pgEnum("task_type", ["phone", "sms", "email", "followup", "appointment", "personal", "other"]);

// My Day items, deal reminders and tasks, and calendar entries: one dated to-do, optionally on a deal.
// A task without a deal is personal and always belongs to its creator.
export const tasks = pgTable("tasks", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  dealId: uuid("deal_id").references(() => deals.id),
  assigneeId: uuid("assignee_id").notNull().references(() => users.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  type: taskType("type").notNull(),
  title: text("title").notNull(),
  dueDate: date("due_date").notNull(),
  dueTime: time("due_time"), // local wall-clock time; null = all day
  notes: text("notes"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("tasks_assignee_due_idx").on(t.assigneeId, t.dueDate), index("tasks_deal_idx").on(t.dealId)]);

// An office's consent and disclosure templates (Office Edit > Consent Templates). Admin lookups, so hard-deleted (audited).
export const consentTemplates = pgTable("consent_templates", {
  id: id(),
  officeId: uuid("office_id").notNull().references(() => offices.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  acceptance: boolean("acceptance").notNull().default(false),
  acceptanceText: text("acceptance_text"),
  signature: boolean("signature").notNull().default(false),
  pageBreak: boolean("page_break").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("consent_templates_office_idx").on(t.officeId)]);

// Lender fee rates (%) and the days until each is paid. Validation lives in lenders.ts.
export type Fees = Record<string, number>;
// Ratio limits that replace the defaults in validate.ts for deals with this lender; a missing key keeps the default.
export type LenderLimits = { gds?: number; tds?: number; ltv?: number };

// Organization-wide. Deals store the lender and product by name (closeOut//Lender, closeOut//Product).
export const lenders = pgTable("lenders", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  code: text("code").notNull().default(""),
  displayAs: text("display_as").notNull(),
  underwriterType: text("underwriter_type").notNull().default("Internal"),
  underwriters: jsonb("underwriters").$type<string[]>().notNull().default([]),
  defaultUnderwriter: text("default_underwriter").notNull().default(""),
  fees: jsonb("fees").$type<Fees>().notNull().default({}),
  limits: jsonb("limits").$type<LenderLimits>().notNull().default({}),
  // Who may pick this lender on a deal: everyone, or only the listed users.
  allAgents: boolean("all_agents").notNull().default(true),
  agentIds: jsonb("agent_ids").$type<string[]>().notNull().default([]),
  // Removed lenders are hidden, not deleted: old deals still name them.
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("lenders_org_name_uq").on(t.organizationId, t.name)]);

export const lenderProducts = pgTable("lender_products", {
  id: id(),
  lenderId: uuid("lender_id").notNull().references(() => lenders.id),
  name: text("name").notNull(),
  term: integer("term").notNull(),
  fees: jsonb("fees").$type<Fees>().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("lender_products_name_uq").on(t.lenderId, t.name)]);

// One row per compliance review of a deal (status, note, lock), never updated: the deal's Compliance table.
export const complianceReviews = pgTable("compliance_reviews", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  status: complianceStatus("status").notNull(),
  note: text("note").notNull().default(""),
  locked: boolean("locked").notNull(),
  createdAt: createdAt(),
}, (t) => [index("compliance_reviews_deal_idx").on(t.dealId)]);

export const amlRisk = pgEnum("aml_risk", ["low", "medium", "high"]);
export const sanctionScreening = pgEnum("sanction_screening", ["not_screened", "clear", "possible_match"]);

// The current AML assessment of each borrower on a deal; earlier answers are in the audit log.
// Sanction screening is recorded by hand (list checked, date), not run by Keyway.
export const amlAssessments = pgTable("aml_assessments", {
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  risk: amlRisk("risk").notNull(),
  screening: sanctionScreening("screening").notNull().default("not_screened"),
  screeningList: text("screening_list").notNull().default(""),
  screenedOn: date("screened_on"),
  assessedBy: uuid("assessed_by").notNull().references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.dealId, t.contactId] })]);

// ---- Client portal (portal.ts and friends). Visibility rules: docs/client-portal.md and the RLS migration.

// One per firm and person. A person who is a client of two firms has two rows sharing one account_id (their sign-in);
// the password hash is kept the same on all of them. Both are null until the first invitation is accepted.
export const clients = pgTable("clients", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  contactId: uuid("contact_id").notNull().unique().references(() => contacts.id),
  email: text("email").notNull(),
  accountId: uuid("account_id"),
  passwordHash: text("password_hash"),
  // Set while the password is the temporary one from the welcome email: it stops working then, and must be changed at first sign-in.
  passwordExpiresAt: timestamp("password_expires_at", { withTimezone: true }),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("clients_org_account_uq").on(t.organizationId, t.accountId), index("clients_email_idx").on(t.email), index("clients_account_idx").on(t.accountId)]);

export const invitationStatus = pgEnum("invitation_status", ["pending", "accepted", "revoked"]);

// One per welcome email. Pending until the client replaces the temporary password; expires_at is that password's expiry.
// token_hash is from the old one-time-link invitations and is no longer written.
export const clientInvitations = pgTable("client_invitations", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  clientId: uuid("client_id").references(() => clients.id),
  email: text("email").notNull(),
  tokenHash: text("token_hash").unique(),
  status: invitationStatus("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => [index("client_invitations_deal_idx").on(t.dealId)]);

// A firm's override of a built-in template (email.ts).
export const emailTemplates = pgTable("email_templates", {
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  kind: text("kind").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.organizationId, t.kind] })]);

export const deliveryStatus = pgEnum("delivery_status", ["not_configured", "sent", "failed", "delivered", "bounced", "complained"]);

// Every attempted email. Bodies are not stored, only who, what kind, and what happened.
export const emailDeliveries = pgTable("email_deliveries", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  kind: text("kind").notNull(),
  toEmail: text("to_email").notNull(),
  status: deliveryStatus("status").notNull(),
  providerId: text("provider_id").unique(),
  error: text("error"),
  invitationId: uuid("invitation_id").references(() => clientInvitations.id),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("email_deliveries_invitation_idx").on(t.invitationId)]);

export const scanStatus = pgEnum("scan_status", ["pending", "not_scanned", "clean", "infected", "released"]);

// Every uploaded file (document versions and message attachments). The id is the storage key.
// pending = upload URL issued, bytes not checked yet. Downloads need clean or released (staff release from quarantine).
export const files = pgTable("files", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  fileName: text("file_name").notNull(),
  contentType: text("content_type"),
  size: integer("size"),
  scanStatus: scanStatus("scan_status").notNull().default("pending"),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
  uploadedByClientId: uuid("uploaded_by_client_id").references(() => clients.id),
  releasedBy: uuid("released_by").references(() => users.id),
  createdAt: createdAt(),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
}, (t) => [index("files_deal_idx").on(t.dealId)]);

export type ChecklistItem = { name: string; category: string; description: string };

export const documentChecklists = pgTable("document_checklists", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  items: jsonb("items").$type<ChecklistItem[]>().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("document_checklists_name_uq").on(t.organizationId, t.name)]);

export const requestStatus = pgEnum("request_status", ["requested", "uploaded", "under_review", "accepted", "replacement_required"]);

// applicant_contact_id null = shared with every applicant on the deal; set = only that applicant (and staff) see it.
export const documentRequests = pgTable("document_requests", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  applicantContactId: uuid("applicant_contact_id").references(() => contacts.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  status: requestStatus("status").notNull().default("requested"),
  replacementReason: text("replacement_reason"),
  dueDate: date("due_date"),
  lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [index("document_requests_deal_idx").on(t.dealId)]);

export const documentVersions = pgTable("document_versions", {
  id: id(),
  requestId: uuid("request_id").notNull().references(() => documentRequests.id),
  fileId: uuid("file_id").notNull().unique().references(() => files.id),
  version: integer("version").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("document_versions_uq").on(t.requestId, t.version)]);

// The firm's configurable client-facing stages, in order.
export const progressStages = pgTable("progress_stages", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  label: text("label").notNull(),
  clientDescription: text("client_description").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  position: integer("position").notNull(),
  active: boolean("active").notNull().default(true),
}, (t) => [index("progress_stages_org_idx").on(t.organizationId, t.position)]);

// Published to the client; never edited.
export const progressUpdates = pgTable("progress_updates", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  stageId: uuid("stage_id").notNull().references(() => progressStages.id),
  message: text("message").notNull().default(""),
  authorId: uuid("author_id").notNull().references(() => users.id),
  publishedAt: createdAt(),
}, (t) => [index("progress_updates_deal_idx").on(t.dealId)]);

// applicant_contact_id null = every applicant with access; set = that applicant only. Staff who can see the deal can always read.
export const conversations = pgTable("conversations", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  applicantContactId: uuid("applicant_contact_id").references(() => contacts.id),
  subject: text("subject").notNull(),
  createdAt: createdAt(),
}, (t) => [index("conversations_deal_idx").on(t.dealId)]);

export const messages = pgTable("messages", {
  id: id(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  authorUserId: uuid("author_user_id").references(() => users.id),
  authorClientId: uuid("author_client_id").references(() => clients.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
}, (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)]);

export const messageAttachments = pgTable("message_attachments", {
  messageId: uuid("message_id").notNull().references(() => messages.id),
  fileId: uuid("file_id").notNull().unique().references(() => files.id),
}, (t) => [primaryKey({ columns: [t.messageId, t.fileId] })]);

// reader = "u:<user id>" or "c:<client id>".
export const conversationReads = pgTable("conversation_reads", {
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  reader: text("reader").notNull(),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.conversationId, t.reader] })]);

// Staff-only notes on a deal. Never selected by any client-facing query and denied to clients by RLS.
export const dealNotes = pgTable("deal_notes", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  authorId: uuid("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
}, (t) => [index("deal_notes_deal_idx").on(t.dealId)]);

// For a staff user or a client, never both. Titles never carry document or message contents.
export const notifications = pgTable("notifications", {
  id: id(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id),
  clientId: uuid("client_id").references(() => clients.id),
  dealId: uuid("deal_id").references(() => deals.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  href: text("href").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.readAt), index("notifications_client_idx").on(t.clientId, t.readAt)]);
