// Deal status rules. No imports, so the browser can use the labels and the server the rules.
export type DealStatus =
  | "lead" | "pre_approval" | "new_deal" | "submitted" | "approved" | "accepted" | "waiting_to_close" | "funded"
  | "declined" | "cancelled" | "parked" | "complete";

// Dashboard column order and names.
export const boardStatuses = [
  ["lead", "Leads"], ["pre_approval", "Pre-Approvals"], ["new_deal", "New Deals"], ["submitted", "Submitted"],
  ["approved", "Approved"], ["accepted", "Accepted"], ["waiting_to_close", "Waiting to Close"],
  ["funded", "Funded + Awaiting Payment"], ["declined", "Declined"], ["cancelled", "Cancelled"],
] as const satisfies readonly (readonly [DealStatus, string])[];

export const statusLabel: Record<DealStatus, string> = {
  ...(Object.fromEntries(boardStatuses) as Record<(typeof boardStatuses)[number][0], string>),
  parked: "Parked",
  complete: "Complete",
};

// Forward moves along the pipeline. Park, cancel and reinstate are handled separately below.
const next: Record<DealStatus, DealStatus[]> = {
  lead: ["pre_approval", "new_deal"],
  pre_approval: ["new_deal", "submitted"],
  new_deal: ["submitted"],
  submitted: ["approved", "declined"],
  approved: ["accepted", "declined"],
  accepted: ["waiting_to_close"],
  waiting_to_close: ["funded"],
  funded: ["complete"],
  declined: ["submitted"],
  cancelled: [],
  parked: [],
  complete: [],
};

const shelved = (s: DealStatus) => s === "parked" || s === "cancelled";

// Every status the deal may move to from `from`, including park / cancel / reinstate.
export function allowedMoves(from: DealStatus, previous: DealStatus | null): DealStatus[] {
  if (shelved(from)) return previous ? [previous] : [];
  if (from === "complete") return [];
  return [...next[from], "parked", "cancelled"];
}

export const isReinstate = (from: DealStatus) => shelved(from);

export const dealCode = (n: number) => `KW-${n}`;
