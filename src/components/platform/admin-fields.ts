// The admin screens' stored fields, shared by the forms and the server whitelist (admin.ts).
// Text fields are free text; checks are stored as "Yes" or left out.

export const roleLabels = { org_admin: "Organization Admin", office_admin: "Office Admin", agent: "Agent", assistant: "Assistant" } as const;

export const provinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

export const officeSelects: Record<string, string[]> = {
  "Street Type": ["Street", "Avenue", "Road", "Drive", "Boulevard", "Crescent", "Court", "Way"],
  "Street Direction": ["None", "North", "South", "East", "West"],
  Province: provinces,
  Country: ["Canada"],
  "Default Condition On": ["None", "Approved", "Accepted"],
};
export const officeText = ["Nickname", "Email", "Business Phone", "Fax Number", "License Number", "Street Number", "Unit Number", "Street Name", "City", "Postal Code"];
export const consentLangs = ["English", "Français"];
export const onlineConsents = ["Credit Bureau Consent", "CASL Consent", "Insurance Referral Consent", "Borrower Politically Exposed Person (PEP) Declaration", "Third Party Disclosure Consent"];
export const documentConsents = ["Client Consent"];
export const consentKey = (name: string, lang: string) => `${name} (${lang})`;
export const officeChecks = ["Track Third Party Disclosure", "Remove all references to Realtors", "Network Consent", "Enable Anti-Money Laundering", "Allow Submission without AML Validation", "AML PEP Declaration"];
export const officeKeys = [
  ...officeText, ...Object.keys(officeSelects), ...officeChecks,
  ...[...onlineConsents, ...documentConsents].flatMap((c) => consentLangs.map((l) => consentKey(c, l))),
];

export const licences = ["Broker", "Agent/Associate/Non Licensed", "Agent/Associate - Mortgage Agent Level 1 License", "Agent/Associate - Mortgage Agent Level 2 License"];
export const userText = ["Licensee Number", "Authorized Title", "Equifax Member #", "TransUnion Member Code", "Website", "Home Phone", "Cell Phone", "Business Phone", "Fax Number", "Company Name", "Job Title"];
export const userChecks = ["Compliance Officer", "Connect Compliance", "Show in All Offices"];
export const incomeFields = ["Mentor Percentage", "Finders Fee", "Volume Bonus", "Performance Bonus", "Incentive", "Brokerage Fee", "Insurance Income", "Misc. Income", "Misc. Expense", "Application Processing Fee", "Royalty Fee", "Network Fee", "Operations Center Fee"];
export const userKeys = ["Licence", "Mentor", ...userText, ...userChecks, ...incomeFields];

// Organization feature flags. Stored and editable; nothing reads them yet, each feature checks its flag as it is built.
export const orgFeatures = ["Enable eSign", "Enable My Day", "Enable Global Search", "Enable Importer", "Enable Pipeline Report", "Enable Report Creator", "Enable Deal Close Out", "Enable Scenario Builder - Calculators", "Enable Co Broker", "Enable Compliance Packaging", "Enable Submit Documents", "Enable Smart Rules Editor", "Enable Localizations", "Enable Submit to Insurer", "Enable Submit to Supplier (Solicitor)", "Enable FSRA"];

// Lenders (lenders.ts). Fees are a rate in % plus the days until it's paid, stored as `vb` and `vbDays`.
export const lenderTypes = ["Bank", "Trust", "Credit Union", "Monoline", "Private", "MIC"];
export const lenderGroups = ["Prime Lenders", "Alternative Lenders", "Private Lenders"];
export const underwriterTypes = ["Internal", "External"];
export const lenderFees = [["vb", "Volume Bonus"], ["pb", "Performance Bonus"], ["ia", "Incentive Amount"], ["ii", "Insurance Income"]] as const;
export const productFees = [["ff", "Finders Fee", "FF"], ["vb", "Volume Bonus", "VB"], ["pb", "Performance Bonus", "PB"], ["ia", "Incentive Amount", "IA"], ["bf", "Brokerage Fee", "BF"], ["ii", "Insurance Income", "II"], ["mi", "Misc Income", "MI"], ["tf", "Trailer Fee", "TF"]] as const;
export const limitKeys = [["gds", "Max GDS"], ["tds", "Max TDS"], ["ltv", "Max LTV"]] as const;
