"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClient, signIn, signOut } from "@/auth";
import { Forbidden } from "@/server/access";
import { ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import {
  clientAddVersion, clientFinishUpload, clientMarkRead, clientReply, clientStartConversation, clientStartUpload, readClientNotifications, saveClientProfile,
  setOwnPassword, type ClientAccount,
} from "@/server/portal-client";

// Client-side actions. Every one re-loads the signed-in client and checks the deal through their own applicant record.
type Result<T = undefined> = { error?: string; data?: T };
type Ctx = { db: Awaited<ReturnType<typeof getDb>>; account: ClientAccount };

async function run<T>(fn: (c: Ctx) => Promise<T>, refresh = true): Promise<Result<T>> {
  try {
    const data = await fn({ db: await getDb(), account: await requireClient() });
    if (refresh) revalidatePath("/portal", "layout");
    return { data };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof Forbidden) return { error: e.message };
    throw e;
  }
}

export async function clientLogin(form: FormData) {
  try {
    await signIn("client", { email: form.get("email"), password: form.get("password"), redirectTo: "/portal" });
  } catch (e) {
    if (e instanceof AuthError && e.type === "CredentialsSignin") redirect("/portal/login?error=1");
    throw e;
  }
}

export async function clientLogout() {
  await signOut({ redirectTo: "/portal/login" });
}

// First sign-in: replaces the temporary password from the welcome email.
export async function setPasswordAction(_: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "The passwords don't match" };
  try {
    await setOwnPassword(await getDb(), await requireClient({ temporary: true }), password);
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    throw e;
  }
  redirect("/portal");
}

type FileInput = { fileName: string; size: number; contentType: string };
export const clientStartUploadAction = async (dealId: string, input: FileInput) => run(({ db, account }) => clientStartUpload(db, account, dealId, input), false);
export const clientFinishUploadAction = async (fileId: string) =>
  run(async ({ db, account }) => {
    const f = await clientFinishUpload(db, account, fileId);
    return { id: f.fileId, fileName: f.fileName, scan: f.scan };
  }, false);
export const clientAddVersionAction = async (requestId: string, fileId: string) => run(({ db, account }) => clientAddVersion(db, account, requestId, fileId));

export const clientStartConversationAction = async (dealId: string, input: { subject: string; body: string; fileIds: string[] }) =>
  run(async ({ db, account }) => (await clientStartConversation(db, account, dealId, input)).id);
export const clientReplyAction = async (conversationId: string, body: string, fileIds: string[]) => run(({ db, account }) => clientReply(db, account, conversationId, body, fileIds));
export const clientMarkReadAction = async (conversationId: string) => run(({ db, account }) => clientMarkRead(db, account, conversationId));

export const readClientNotificationsAction = async () => run(({ db, account }) => readClientNotifications(db, account));
export const saveProfileAction = async (clientId: string, input: Record<string, unknown>) => run(({ db, account }) => saveClientProfile(db, account, clientId, input));
