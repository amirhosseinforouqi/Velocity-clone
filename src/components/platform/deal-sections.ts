// Velocity's deal workspace layout, taken from its section templates (labels only, no client data).
// A field is "Label" or "Label|type", type being check, select, date, area or calc (read-only, computed in the browser).
// A group with `cols` is a table; its rows come from `rows` or the placeholder deal's tables.
export type Group = {
  title?: string;
  fields?: string[];
  cols?: string[];
  rows?: string[][];
  buttons?: string[];
  blank?: boolean; // ignore placeholder values (fields repeat labels used elsewhere)
  repeat?: string; // one of a numbered family ("Asset 1", "Asset 2"…): shown only once filled or added, with Add / Remove
  custom?: "conditions" | "reminders" | "tasks" | "compliance" | "contacts" | "referrals" | "progress" | "aftercare"; // rendered by its own component instead of cols/rows
};
export type Section = { id: string; title: string; groups: Group[] };

const mortgage = (n: number): Group => ({
  title: `Mortgage #${n}`,
  blank: true,
  fields: [
    "Mortgage Type|select", "Mortgage Holder", "Mortgage #", "Balance", "Payment", "Payment Frequency|select",
    "Maturity Date|date", "Rate Type|select", "Interest Rate", "Term Type|select", "Original Mtg Amount",
    "Blended Amortization|check", "Insured|check", "Insurer|select", "Insurance Account#", "Payoff|select",
  ],
});

// Numbered groups keep the flat "section/group/label" storage: each entry is its own group, so saveDeal needs no changes.
// ponytail: fixed maximum per family; move to real child tables if a file ever needs more entries than this.
const repeat = (family: string, count: number, fields: string[], from = 1): Group[] =>
  Array.from({ length: count }, (_, i) => ({ title: `${family} ${i + from}`, repeat: family, blank: true, fields }));

const applicantFields = [
  "Applicant Type|select", "Relationship to Primary|select", "Salutation|select", "First Name", "Middle Name", "Last Name", "Preferred Name",
  "Email", "Cell Phone", "Home Phone", "Work Phone", "DOB|date", "SIN", "Marital Status|select", "Dependents", "Residency|select",
  "Current Address|area", "Time at Address", "Residential Status|select", "Previous Address|area", "ID Type|select", "ID Number", "ID Expiry|date",
];
const employmentFields = [
  "Applicant Name", "Employment Category|select", "Employment Status|select", "Company Name", "Job Title", "Job Type|select", "Start Date|date",
  "End Date|date", "Income Type|select", "Annual Income", "Years in Business", "Employer Phone", "Employer Address|area",
];

const rentals = ["Rental Income", "Rental Income Options|select", "Rental Add/Offset|select"];
const expenses = ["Hydro", "Heating Cost", "Management", "Repairs", "Insurance", "Interest", "Other"];

export const sections: Section[] = [
  { id: "lead", title: "Lead", groups: [{ fields: ["Lead Stage|select", "Lead Source|select", "Tags", "Next Step", "Lost Reason"] }] },
  { id: "reminders", title: "Reminders", groups: [{ custom: "reminders" }] },
  { id: "tasks", title: "Deal Specific Tasks", groups: [{ custom: "tasks" }] },
  { id: "progress", title: "Progress", groups: [{ custom: "progress" }] },
  { id: "aftercare", title: "After Care", groups: [{ custom: "aftercare" }] },
  { id: "pinnedNotes", title: "Pinned Notes", groups: [{ cols: ["Entry Date", "Note", "Username"] }] },
  { id: "notes", title: "Notes", groups: [{ cols: ["Entry Date", "Note", "Username", "Actions"], buttons: ["Add Note"] }] },
  {
    id: "assetsProperties",
    title: "Assets & Properties",
    groups: [
      { title: "Totals", fields: ["Total Assets|calc", "Total Liabilities|calc", "Net Worth|calc"] },
      ...repeat("Asset", 8, ["Asset Type|select", "Description", "Institution", "Value", "Used for Down Payment|check"]),
      ...repeat("Liability", 10, ["Liability Type|select", "Lender / Creditor", "Credit Limit", "Balance", "Monthly Payment", "Maturity Date|date", "Paid Off at Closing|check"]),
      {
        title: "Property",
        blank: true,
        fields: [
          "Who owns it|select", "Occupancy|select", "Property Value", "Original Date|date", "Original Price", "Future Status|select",
          "Annual Taxes", "Condo Fees", "Fees Incl. Heat|check", "Calculate Condo Fees @100%|check", "Include in TDS|check",
          "Property Equity", ...rentals, ...expenses,
        ],
      },
      mortgage(1),
      mortgage(2),
      mortgage(3),
      { title: "Property Totals", blank: true, fields: ["Property Value", "Mortgages", "Payments", "Expenses", "Rental Income", "Rental Expenses"] },
    ],
  },
  {
    id: "conditions",
    title: "Conditions & Documents",
    groups: [
      { fields: ["Lender Conditions Met|check"] },
      { title: "Lender Conditions And Documents", custom: "conditions" },
      { title: "Document Submission History", cols: ["Mortgage Request Nbr", "Lender", "Document", "File Type", "Status", "Date Sent"] },
      { title: "Emails", cols: ["Message", "Sent From", "Sent to", "Subject", "User", "Cancel Request"] },
      { title: "Compliance", custom: "compliance" },
    ],
  },
  {
    id: "subjectProperty",
    title: "Subject Property Details",
    groups: [
      { title: "Address", fields: ["Unit #", "Street #", "Street Name", "Street Type|select", "Direction|select", "City", "Province|select", "Postal Code"] },
      {
        title: "Details",
        fields: [
          "Occupied By|select", "Purpose|select", "Legal Description|area", "PID/PIN/Block", "Conc/Township", "MLS Listed|check", "MLS #",
          "Construction Type|select", "Dwelling Type|select", "Dwelling Style|select", "Tenure|select", "Living Space", "Lot Size",
          "Heating Type|select", "Water Info|select", "Sewage Info|select", "Usage|select", "# of Units", "Year Built", "Garage Size|select",
          "Garage Type|select", "Environmental Hazard|check", "Zoning|select", "Annual Taxes", "Tax Year", "Paid By|select", "Condo Fees",
          "Calculate Condo Fees @100%|check", "Fees Incl. Heat|check", ...expenses, ...rentals, "Purchase Price", "Estimated Value",
          "Appraisal Value", "Appraisal Date|date", "Total Expenses",
        ],
      },
      { title: "Validation Report History", cols: ["Date", "Report", "Requested By", "Status"] },
    ],
  },
  {
    id: "mortgageRequest",
    title: "Mortgage Request",
    groups: [
      {
        title: "Mortgage Breakdown",
        fields: [
          "Application Type|select", "Mortgage Type|select", "Loan Type|select", "Application Purpose|select", "Program|select", "Purchase Price",
          "Down Payment", "1st Mortgage Total", "2nd Mortgage Total", "3rd Mortgage Total", "Insurer|select", "Insurer Ref",
          "Premium Rate", "Mtg Ins Premium", "Total Mortgage Amount with Premium", "LOC Repayment Type|select",
        ],
      },
      {
        title: "File and Lender Details",
        fields: [
          "Broker File #", "Origination File #", "Lender Ref #", "Credit Tier|select", "Rate Hold Days", "Rate Hold Expiry|date",
          "Lender Commitment|date",
        ],
      },
      { title: "Improvements", cols: ["Description", "Amount", "Progress Advance"] },
      {
        title: "Rates and Payments",
        fields: [
          "Interest Rate", "Discount Rate", "Premium Rate", "Buydown Rate", "Net Rate", "Variable To Prime", "Rate Type|select",
          "Term Type|select", "Payment Frequency|select", "Compounded Period|select", "Term|select", "Amortization|select",
          "Amortization Months|select", "Total Loan Amount", "Monthly Payment", "Payment", "Calculated Payment|calc",
        ],
      },
      { title: "Qualifying Details", fields: ["Qualifying Rate", "Qualifying Compounded Period|select", "Qualifying Amortization|select", "Qualifying Payment"] },
      {
        title: "Payment Summary",
        fields: [
          "Estimated Property Taxes", "IAD Date|date", "IAD Amount", "Mortgage Payment", "First Payment|date", "Maturity Date|date",
          "MPP Insurance Payment", "Other Insurance", "Total Payment",
        ],
      },
      {
        title: "Business Loan",
        fields: [
          "Legal Business Name", "Operating Name", "Registration #", "Industry", "Ownership Structure|select", "Years Operating", "Requested Financing",
          "Annual Revenue", "Average Monthly Bank Deposits", "Existing Business Debts", "Business Address|area", "Purpose of Financing|area",
        ],
      },
      { title: "Lenders", cols: ["Lender", "Product", "Application Type", "Loan Type", "Rate Type", "Term", "Net Rate", "Submitted", "Approved"] },
      {
        title: "Lender Submission",
        fields: ["Agent|select", "Submission Agent|select", "Line Of Business|select", "Co Agent|select", "Submission Note|area"],
        buttons: ["Submit To Lender", "Update Lender", "Add New Request"],
      },
      { title: "Co Broker", cols: ["Name", "Office", "Split"] },
    ],
  },
  {
    id: "borrowers",
    title: "Borrowers",
    groups: [
      {
        title: "Applicant",
        fields: [
          "Applicant Type|select", "Relationship to Primary|select", "Salutation|select", "First Name", "Initial", "Last Name",
          "Suffix|select", "Email", "Home Phone", "Cell Phone", "Work Phone", "Fax", "Contact Preference|select", "DOB|date", "SIN",
          "Language|select", "Marital Status|select", "Spouse|select", "Dependents", "Middle Name", "Preferred Name",
        ],
      },
      {
        title: "Address & Identification",
        fields: ["Current Address|area", "Time at Address", "Residential Status|select", "Previous Address|area", "ID Type|select", "ID Number", "ID Expiry|date"],
      },
      {
        title: "Residency",
        fields: [
          "First Time Buyer|check", "Residency|select", "Resided in Canada|select", "Immigration Status|select", "Arrival Date|date",
          "Is Holding Company|check", "Holding Company Name",
        ],
      },
      {
        title: "Employment",
        fields: [
          "Employment Category|select", "Employment Status|select", "Company Name", "Start Date|date", "Self Employed|check", "Company Type|select", "Operating As", "Gross Revenue",
          "Pays Self|select", "T4", "Business Income", "Dividends", "Commission", "Job Title", "Job Type|select", "Time Worked",
          "Employment Type|select", "Industry Sector|select", "Income Type|select", "Income Period|select", "Receives Benefits|check",
          "Includes Variable Income|check", "Additional Income|select", "Additional Income Amount", "Time in Industry", "Employer Phone",
          "Employer Address|area",
        ],
      },
      ...repeat("Employment", 3, employmentFields, 2),
      ...repeat("Other Income", 4, ["Other Income Type|select", "Description", "Amount", "Income Period|select"]),
      ...repeat("Applicant", 3, applicantFields, 2),
    ],
  },
  { id: "emailHistory", title: "System Email History", groups: [{ cols: ["Date Sent", "Subject", "Sender", "Recipient"] }] },
  {
    id: "referral",
    title: "Referral",
    groups: [
      { blank: true, fields: ["First Name", "Last Name", "Company Name", "Email", "Referral Type|select", "Other Type"] },
      { title: "Referral Source Contacts", custom: "referrals" },
    ],
  },
  { id: "dealContacts", title: "Deal Contacts", groups: [{ custom: "contacts" }] },
  { id: "insurance", title: "Insurance", groups: [{ fields: ["Has Life Insurance|check", "Charge Type|select", "Purchase Price", "Monthly Payment"] }] },
  {
    id: "closeOut",
    title: "Close-Out Process",
    groups: [
      { fields: ["Closing Date|date", "Lender", "Product", "Mortgage Amount"], buttons: ["Complete the Close-Out Process"] },
      {
        title: "Commissions",
        cols: ["", "Expected", "Received", "Date Received"],
        rows: ["Finder Fees", "Volume Bonus", "Performance Bonus", "Insurance Income"].map((r) => [r, "", "", ""]),
      },
      { title: "Co-Broker", cols: ["Name", "Office", "Split"], buttons: ["Add Co-Broker"] },
      { title: "Close-Out Summary", blank: true, fields: ["Contact Details", "Active Properties", "Mortgages", "Active CRM Campaigns"] },
    ],
  },
];

// The workspace's tabs, in the order an application is worked. A part is a section, optionally only some of its groups.
type Part = { section: string; title?: string; only?: (g: Group) => boolean };
const isIncome = (g: Group) => /^(Employment|Other Income)/.test(g.title ?? "");
export const dealTabs: { slug: string; label: string; parts: Part[] }[] = [
  { slug: "client", label: "Client & Applicants", parts: [{ section: "lead", title: "Lead & CRM" }, { section: "borrowers", title: "Applicants", only: (g) => !isIncome(g) }, { section: "referral" }, { section: "dealContacts" }] },
  { slug: "income", label: "Employment & Income", parts: [{ section: "borrowers", title: "Employment & Income", only: isIncome }] },
  { slug: "assets", label: "Assets & Liabilities", parts: [{ section: "assetsProperties", title: "Assets, Liabilities & Other Properties" }] },
  { slug: "property", label: "Property & Mortgage", parts: [{ section: "subjectProperty" }, { section: "mortgageRequest" }, { section: "insurance" }] },
  { slug: "documents", label: "Documents", parts: [{ section: "conditions", title: "Lender Conditions & Compliance" }] },
  { slug: "messages", label: "Messages", parts: [] },
  { slug: "lender", label: "Lender & Stage", parts: [{ section: "progress" }, { section: "closeOut" }, { section: "aftercare" }] },
  { slug: "tasks", label: "Tasks & Follow-ups", parts: [{ section: "reminders" }, { section: "tasks" }] },
  { slug: "activity", label: "Activity History", parts: [] },
];
// Addresses from before the redesign still open the matching tab.
export const legacyTabs: Record<string, string> = {
  borrowers: "client", assetsProperties: "assets", communicationHistory: "messages", conditionsAndDocuments: "documents", conditions: "documents",
  insurance: "property", mortgageRequests: "property", referrals: "client", contacts: "client", remindersAndTasks: "tasks", progress: "lender",
  aftercare: "lender", clientPortal: "messages",
};

// Storage key for one workspace field: "section/group/label". Groups repeat labels, so the label alone isn't unique.
export const fieldKey = (s: { id: string }, g: Group, spec: string) => `${s.id}/${g.title ?? ""}/${spec.split("|")[0]}`;

export const fieldKeys = new Set(sections.flatMap((s) => s.groups.flatMap((g) => (g.fields ?? []).filter((f) => !f.endsWith("|calc")).map((f) => fieldKey(s, g, f)))));

// Choices for the common selects. A select not listed here is edited as free text until its lookup exists (admin lookups, step 9).
const terms = (list: number[]) => list.map((n) => `${n} Year${n > 1 ? "s" : ""}`);
export const selectOptions: Record<string, string[]> = {
  "Applicant Type": ["Primary", "Co-Applicant", "Guarantor"],
  "Relationship to Primary": ["Spouse", "Common Law", "Parent", "Child", "Sibling", "Other"],
  Salutation: ["Mr.", "Mrs.", "Ms.", "Miss", "Dr."],
  Suffix: ["Jr.", "Sr.", "II", "III"],
  "Contact Preference": ["Email", "Cell Phone", "Home Phone", "Work Phone"],
  Language: ["English", "French"],
  "Marital Status": ["Single", "Married", "Common Law", "Separated", "Divorced", "Widowed"],
  Residency: ["Canadian Citizen", "Permanent Resident", "Work Permit", "Non-Resident"],
  "Employment Status": ["Current", "Previous"],
  "Employment Category": ["Employed", "Self-employed", "Independent contractor", "Retired", "Other"],
  "Other Income Type": ["Rental", "Pension", "Child / Spousal Support", "Investment", "Government Benefits", "Other"],
  "Asset Type": ["Chequing", "Savings", "Investments", "RRSP", "TFSA", "Real Estate", "Vehicle", "Gift", "Other"],
  "Liability Type": ["Credit Card", "Line of Credit", "Personal Loan", "Car Loan", "Car Lease", "Student Loan", "Mortgage", "Other"],
  "Residential Status": ["Own", "Rent", "Live with Parents", "Other"],
  "ID Type": ["Driver's Licence", "Passport", "PR Card", "Citizenship Card", "Other"],
  "Ownership Structure": ["Sole Proprietorship", "Partnership", "Corporation", "Other"],
  "Job Type": ["Full Time", "Part Time", "Seasonal", "Contract"],
  "Employment Type": ["Salaried", "Hourly", "Commissioned", "Self-Employed"],
  "Income Type": ["Salary", "Hourly", "Commission", "Bonus", "Self-Employed"],
  "Income Period": ["Annually", "Monthly", "Semi-Monthly", "Bi-Weekly", "Weekly"],
  Province: [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
    "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon",
  ],
  "Street Type": ["Avenue", "Boulevard", "Court", "Crescent", "Drive", "Lane", "Place", "Road", "Street", "Way"],
  Direction: ["N", "S", "E", "W", "NE", "NW", "SE", "SW"],
  "Occupied By": ["Owner", "Tenant", "Owner and Tenant"],
  Purpose: ["Owner Occupied", "Rental", "Second Home", "Owner Occupied and Rental"],
  "Construction Type": ["Existing", "New"],
  "Dwelling Type": ["Detached", "Semi-Detached", "Townhouse", "Condo", "Duplex", "Triplex", "Fourplex", "Mobile"],
  "Dwelling Style": ["Bungalow", "Two Storey", "Split Level", "Storey and a Half", "Three Storey"],
  Tenure: ["Freehold", "Condo", "Leasehold"],
  "Heating Type": ["Forced Air", "Electric Baseboard", "Hot Water", "Geothermal", "Other"],
  "Water Info": ["Municipal", "Well", "Other"],
  "Sewage Info": ["Municipal", "Septic", "Other"],
  "Paid By": ["Borrower", "Lender"],
  "Application Type": ["Purchase", "Refinance", "Switch/Transfer", "Renewal", "Pre-Approval"],
  "Application Purpose": [
    "Purchase", "Refinance", "Switch/Transfer", "Renewal", "Pre-Approval", "Equity Take Out", "Builder", "Construction", "Development",
    "Renovations", "Other",
  ],
  Program: [
    "Bad Credit", "Bridge Loan", "Business Loan", "Commercial Mortgage", "Construction Loan", "Consumer Proposal Payout",
    "Debt Consolidation Payout", "Equity Takeout", "First Time Buyer", "HELOC", "Equity Program", "Home Improvement Mortgage",
    "Legal Action", "Mortgage Renewal", "Networth Program", "New To Canada", "Non Resident", "Other", "Refinance Mortgage", "Rental",
    "Repeat Buyer", "Reverse Mortgage", "Rent to Own", "Second Home", "Second Mortgage", "Self Employed", "Spousal Buyout",
    "Stop Foreclosure", "Stop Power Of Sale", "Third Mortgage",
  ],
  "Credit Tier": ["Prime", "Sub-Prime"],
  "Mortgage Type": ["Standard", "HELOC", "Collateral"],
  "Loan Type": ["Mortgage", "Line of Credit"],
  "Rate Type": ["Fixed", "Variable", "Adjustable", "Capped Variable"],
  "Term Type": ["Closed", "Open", "Convertible"],
  "Payment Frequency": [
    "Monthly", "Semi-Monthly", "Bi-Weekly", "Accelerated Bi-Weekly", "Weekly", "Accelerated Weekly", "Quarterly", "Semi-Annually", "Annually",
  ],
  "Compounded Period": ["Monthly", "Semi-Annually", "Annually"],
  Term: ["6 Months", ...terms([1, 2, 3, 4, 5, 7, 10])],
  Amortization: terms([5, 10, 15, 20, 25, 30, 35, 40]),
  "Amortization Months": Array.from({ length: 12 }, (_, i) => String(i)),
  "Charge Type": ["First", "Second", "Third"],
  "Line Of Business": ["Residential", "Commercial"],
  Insurer: ["CMHC", "Sagen", "Canada Guaranty"],
};
