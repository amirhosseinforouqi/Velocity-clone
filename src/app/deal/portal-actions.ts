"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth";
import { Forbidden } from "@/server/access";
import { getOrganization, isAdmin } from "@/server/admin";
import { ValidationError } from "@/server/contacts";
import { dealStaff } from "@/server/deals";
import { emailConfigured } from "@/server/email";
import { getDb } from "@/server/db";
import {
  addNote, assignDeal, cancelRequest, createClientExperience, createLead, invitationPreview, finishUpload, inviteApplicant, readStaffNotifications, releaseFile, remindRequest, requestDocuments, resendInvitation,
  revokeInvitation, reviewRequest, setPortalAccess, setStage, staffAddVersion, staffDeal, staffMarkRead, staffReply, startConversation, startUpload, topBarPortal,
} from "@/server/portal";
import { purgeDeal } from "@/server/portal-admin";

// Every action re-checks the signed-in staff user and the deal's scope in the server function it calls.
type Result<T = undefined> = { error?: string; data?: T };
type Ctx = { db: Awaited<ReturnType<typeof getDb>>; actor: Awaited<ReturnType<typeof requireActor>> };

async function run<T>(fn: (c: Ctx) => Promise<T>, refresh = true): Promise<Result<T>> {
  try {
    const data = await fn({ db: await getDb(), actor: await requireActor() });
    if (refresh) revalidatePath("/", "layout");
    return { data };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof Forbidden) return { error: e.message };
    throw e;
  }
}

// An invitation's link only comes back when the email wasn't sent, so staff can share it another way.
// The one-time code only ever travels inside the setup link, never as a separate password.
const safe = (i: Awaited<ReturnType<typeof inviteApplicant>>) => ({ ...i, login: i.login && { link: i.login.link, username: i.login.username, expires: i.login.expires, existing: i.login.password === null } });
export const inviteAction = async (dealId: string, contactId: string) => run(async ({ db, actor }) => safe(await inviteApplicant(db, actor, dealId, contactId)));
export const clientExperienceAction = async (input: Record<string, unknown>) => run(async ({ db, actor }) => {
  const r = await createClientExperience(db, actor, input);
  return { dealId: r.dealId, invite: safe(r.invite) };
});
export const resendInviteAction = async (id: string) => run(async ({ db, actor }) => safe(await resendInvitation(db, actor, id)));

// New Lead: what the form needs to offer, the lead itself, and the welcome email as staff will review it before confirming.
export const leadFormAction = async () => run(async ({ db, actor }) => ({
  me: actor.id, admin: isAdmin(actor), emailConfigured: emailConfigured(),
  staff: (await dealStaff(db, actor, actor)).map((u) => ({ id: u.id, name: u.name })),
  sources: (await getOrganization(db, actor.organizationId)).settings.leadSources,
}), false);
export const createLeadAction = async (input: Record<string, unknown>) => run(async ({ db, actor }) => {
  const r = await createLead(db, actor, input);
  return { dealId: r.dealId, invite: r.invite && safe(r.invite) };
});
export const invitationPreviewAction = async (firstName: string) => run(({ db, actor }) => invitationPreview(db, actor, firstName), false);
export const revokeInviteAction = async (id: string) => run(({ db, actor }) => revokeInvitation(db, actor, id));
export const portalAccessAction = async (dealId: string, contactId: string, on: boolean) => run(({ db, actor }) => setPortalAccess(db, actor, dealId, contactId, on));

export const requestDocumentsAction = async (dealId: string, input: Record<string, string>) => run(async ({ db, actor }) => (await requestDocuments(db, actor, dealId, input)).length);
export const reviewAction = async (requestId: string, to: string, reason?: string) => run(({ db, actor }) => reviewRequest(db, actor, requestId, to, reason));
export const remindAction = async (requestId: string) => run(({ db, actor }) => remindRequest(db, actor, requestId));
export const cancelRequestAction = async (requestId: string) => run(({ db, actor }) => cancelRequest(db, actor, requestId));
export const releaseFileAction = async (fileId: string) => run(({ db, actor }) => releaseFile(db, actor, fileId));

// Uploads: start (checks name/type/size, returns where to PUT the bytes), then finish (checks the bytes, scans).
export const staffStartUploadAction = async (dealId: string, input: { fileName: string; size: number; contentType: string }) =>
  run(async ({ db, actor }) => startUpload(db, { userId: actor.id }, await staffDeal(db, actor, dealId), input), false);
export const staffFinishUploadAction = async (fileId: string) =>
  run(async ({ db, actor }) => {
    const f = await finishUpload(db, { userId: actor.id }, fileId);
    return { id: f.id, fileName: f.fileName, scan: f.scanStatus };
  }, false);
export const staffAddVersionAction = async (requestId: string, fileId: string) => run(({ db, actor }) => staffAddVersion(db, actor, requestId, fileId));

export const setStageAction = async (dealId: string, stageId: string, message: string) => run(({ db, actor }) => setStage(db, actor, dealId, stageId, message));

export const startConversationAction = async (dealId: string, input: { subject: string; body: string; applicantContactId: string; fileIds: string[] }) =>
  run(async ({ db, actor }) => (await startConversation(db, actor, dealId, input)).id);
export const replyAction = async (conversationId: string, body: string, fileIds: string[]) => run(({ db, actor }) => staffReply(db, actor, conversationId, body, fileIds));
export const markReadAction = async (conversationId: string) => run(({ db, actor }) => staffMarkRead(db, actor, conversationId));

export const addNoteAction = async (dealId: string, body: string, category: string) => run(({ db, actor }) => addNote(db, actor, dealId, body, category));
export const assignAction = async (dealId: string, userId: string) => run(({ db, actor }) => assignDeal(db, actor, dealId, userId || null));
export const purgeDealAction = async (dealId: string) => run(({ db, actor }) => purgeDeal(db, actor, dealId));

// Top bar (polled): unread client messages and notifications.
export const topBarPortalAction = async () => run(({ db, actor }) => topBarPortal(db, actor), false);
export const readNotificationsAction = async () => run(({ db, actor }) => readStaffNotifications(db, actor), false);
