// Velocity's deal workspace layout, taken from its section templates (labels only, no client data).
// A field is "Label" or "Label|type", type being check, select, date or area.
// A group with `cols` is a table; its rows come from `rows` or the placeholder deal's tables.
export type Group = {
  title?: string;
  fields?: string[];
  cols?: string[];
  rows?: string[][];
  buttons?: string[];
  blank?: boolean; // ignore placeholder values (fields repeat labels used elsewhere)
  custom?: "conditions" | "reminders" | "tasks" | "compliance"; // rendered by its own component instead of cols/rows
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

const rentals = ["Rental Income", "Rental Income Options|select", "Rental Add/Offset|select"];
const expenses = ["Hydro", "Heating Cost", "Management", "Repairs", "Insurance", "Interest", "Other"];

export const sections: Section[] = [
  { id: "reminders", title: "Reminders", groups: [{ custom: "reminders" }] },
  { id: "tasks", title: "Deal Specific Tasks", groups: [{ custom: "tasks" }] },
  { id: "pinnedNotes", title: "Pinned Notes", groups: [{ cols: ["Entry Date", "Note", "Username"] }] },
  { id: "notes", title: "Notes", groups: [{ cols: ["Entry Date", "Note", "Username", "Actions"], buttons: ["Add Note"] }] },
  {
    id: "assetsProperties",
    title: "Assets & Properties",
    groups: [
      { title: "Totals", fields: ["Total Assets", "Total Liabilities", "Net Worth"] },
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
          "Application Type|select", "Mortgage Type|select", "Loan Type|select", "Application Purpose|select", "Purchase Price",
          "Down Payment", "1st Mortgage Total", "2nd Mortgage Total", "3rd Mortgage Total", "Insurer|select", "Insurer Ref",
          "Premium Rate", "Mtg Ins Premium", "Total Mortgage Amount with Premium", "LOC Repayment Type|select",
        ],
      },
      { title: "Improvements", cols: ["Description", "Amount", "Progress Advance"] },
      {
        title: "Rates and Payments",
        fields: [
          "Interest Rate", "Discount Rate", "Premium Rate", "Buydown Rate", "Net Rate", "Variable To Prime", "Rate Type|select",
          "Term Type|select", "Payment Frequency|select", "Compounded Period|select", "Term|select", "Amortization|select",
          "Total Loan Amount", "Monthly Payment", "Payment",
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
          "Language|select", "Marital Status|select", "Spouse|select", "Dependents",
        ],
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
          "Employment Status|select", "Company Name", "Self Employed|check", "Company Type|select", "Operating As", "Gross Revenue",
          "Pays Self|select", "T4", "Business Income", "Dividends", "Commission", "Job Title", "Job Type|select", "Time Worked",
          "Employment Type|select", "Industry Sector|select", "Income Type|select", "Income Period|select", "Receives Benefits|check",
          "Includes Variable Income|check", "Additional Income|select", "Additional Income Amount", "Time in Industry", "Employer Phone",
          "Employer Address|area",
        ],
      },
      { title: "Other Income", cols: ["Type", "Description", "Amount", "Period"] },
    ],
  },
  { id: "emailHistory", title: "System Email History", groups: [{ cols: ["Date Sent", "Subject", "Sender", "Recipient"] }] },
  {
    id: "referral",
    title: "Referral",
    groups: [{ blank: true, fields: ["First Name", "Last Name", "Company Name", "Email", "Referral Type|select", "Other Type"] }],
  },
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

export const dealTabs = [
  { slug: "borrowers", label: "Borrowers", sections: ["borrowers"] },
  { slug: "assetsProperties", label: "Assets & Properties", sections: ["assetsProperties"] },
  { slug: "communicationHistory", label: "Communication History", sections: ["pinnedNotes", "notes", "emailHistory"] },
  { slug: "conditionsAndDocuments", label: "Conditions & Documents", sections: ["conditions"] },
  { slug: "insurance", label: "Insurance", sections: ["insurance"] },
  { slug: "mortgageRequests", label: "Mortgage Requests", sections: ["subjectProperty", "mortgageRequest"] },
  { slug: "referrals", label: "Referrals", sections: ["referral"] },
  { slug: "remindersAndTasks", label: "Reminders & Tasks", sections: ["reminders", "tasks"] },
];

// Storage key for one workspace field: "section/group/label". Groups repeat labels, so the label alone isn't unique.
export const fieldKey = (s: { id: string }, g: Group, spec: string) => `${s.id}/${g.title ?? ""}/${spec.split("|")[0]}`;

export const fieldKeys = new Set(sections.flatMap((s) => s.groups.flatMap((g) => (g.fields ?? []).map((f) => fieldKey(s, g, f)))));

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
  "Application Purpose": ["Purchase", "Refinance", "Switch/Transfer", "Renewal", "Pre-Approval", "Equity Take Out"],
  "Mortgage Type": ["Standard", "HELOC", "Collateral"],
  "Loan Type": ["Mortgage", "Line of Credit"],
  "Rate Type": ["Fixed", "Variable", "Adjustable", "Capped Variable"],
  "Term Type": ["Closed", "Open", "Convertible"],
  "Payment Frequency": ["Monthly", "Semi-Monthly", "Bi-Weekly", "Accelerated Bi-Weekly", "Weekly", "Accelerated Weekly"],
  "Compounded Period": ["Monthly", "Semi-Annually", "Annually"],
  Term: ["6 Months", ...terms([1, 2, 3, 4, 5, 7, 10])],
  Amortization: terms([5, 10, 15, 20, 25, 30]),
  "Charge Type": ["First", "Second", "Third"],
  Insurer: ["CMHC", "Sagen", "Canada Guaranty"],
};
