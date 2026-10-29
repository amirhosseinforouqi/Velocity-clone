"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth";
import { Forbidden } from "@/server/access";
import { ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import {
  addNote, assignDeal, cancelRequest, finishUpload, inviteApplicant, readStaffNotifications, releaseFile, remindRequest, requestDocuments, resendInvitation,
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
export const inviteAction = async (dealId: string, contactId: string) => run(({ db, actor }) => inviteApplicant(db, actor, dealId, contactId));
export const resendInviteAction = async (id: string) => run(({ db, actor }) => resendInvitation(db, actor, id));
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

export const addNoteAction = async (dealId: string, body: string) => run(({ db, actor }) => addNote(db, actor, dealId, body));
export const assignAction = async (dealId: string, userId: string) => run(({ db, actor }) => assignDeal(db, actor, dealId, userId || null));
export const purgeDealAction = async (dealId: string) => run(({ db, actor }) => purgeDeal(db, actor, dealId));

// Top bar (polled): unread client messages and notifications.
export const topBarPortalAction = async () => run(({ db, actor }) => topBarPortal(db, actor), false);
export const readNotificationsAction = async () => run(({ db, actor }) => readStaffNotifications(db, actor), false);
