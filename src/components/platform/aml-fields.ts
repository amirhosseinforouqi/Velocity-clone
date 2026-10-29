// The AML risk questionnaire and compliance labels, shared by the deal screen and the server (compliance.ts).
// Keyway's own wording, written to the usual know-your-client checks; it is not legal advice and an organization
// should review it against its own compliance program before relying on it.

export const complianceLabels = { in_progress: "In progress", non_compliant: "Non-compliant", compliant: "Compliant" } as const;
export type ComplianceStatus = keyof typeof complianceLabels;

export const riskLabels = { low: "Low", medium: "Medium", high: "High" } as const;
export type Risk = keyof typeof riskLabels;

// Each answer may raise the risk: "high" answers make the borrower high risk, "medium" ones medium.
export const amlQuestions: { key: string; label: string; options: [answer: string, raises?: "medium" | "high"][] }[] = [
  { key: "id", label: "How was the borrower's identity verified?", options: [["Government photo ID, in person"], ["Government photo ID, remotely with authentication"], ["Dual-process method"], ["Credit file method"]] },
  { key: "pep", label: "Is the borrower a politically exposed person or head of an international organization, or a family member or close associate of one?", options: [["No"], ["Yes", "high"]] },
  { key: "thirdParty", label: "Is anyone other than the borrowers directing the deal or providing funds?", options: [["No"], ["Yes", "high"]] },
  { key: "funds", label: "Where do the down payment and closing funds come from?", options: [["Savings or income"], ["Sale of a property"], ["Gift from family", "medium"], ["Other or not explained", "high"]] },
  { key: "income", label: "Do the borrower's occupation and income fit the size of the deal?", options: [["Yes"], ["No", "medium"]] },
  { key: "residency", label: "Residency", options: [["Canadian citizen or permanent resident"], ["Non-resident", "medium"]] },
  { key: "behaviour", label: "Any unusual behaviour (reluctance to give information, rushing, unexplained changes)?", options: [["No"], ["Yes", "high"]] },
];

// Manual record of a screening done outside Keyway; there is no automated list check.
export const screeningLabels = { not_screened: "Not screened", clear: "No match", possible_match: "Possible match" } as const;
export type Screening = keyof typeof screeningLabels;

// The highest risk any answer raises; a possible sanction-list match is always high.
export function amlRisk(answers: Record<string, string>, screening: Screening): Risk {
  if (screening === "possible_match") return "high";
  const raised = amlQuestions.map((q) => q.options.find(([a]) => a === answers[q.key])?.[1]);
  return raised.includes("high") ? "high" : raised.includes("medium") ? "medium" : "low";
}
