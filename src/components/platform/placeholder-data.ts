// Sample records for LOCAL development and tests only: src/server/seed.ts loads them into an empty
// local database (never in production). Screens must not import these; they read the database.
const me = "Alex Morgan"; // matches the seeded agent@keyway.test

export type Deal = {
  name: string;
  amount: number;
  closingDate?: string;
  followUp?: string;
  conditionsDate?: string;
  submittedDate?: string;
  assigned?: string;
  purpose?: string;
};


// Keyed by the deals dashboard stage names.
export const placeholderDeals: Record<string, Deal[]> = {
  Leads: [
    { name: "Jordan Lee", amount: 0, followUp: "2026-11-03", assigned: me },
    { name: "Priya Shah", amount: 0, assigned: me },
    { name: "Sam Carter", amount: 0, followUp: "2026-11-10", assigned: me },
    { name: "Taylor Brooks", amount: 0, assigned: me },
  ],
  "Pre-Approvals": [
    { name: "Morgan Ellis", amount: 525_000, followUp: "2026-11-05", assigned: me, purpose: "Purchase" },
    { name: "Casey Nguyen", amount: 750_000, assigned: me, purpose: "Purchase" },
  ],
  "New Deals": [
    { name: "Riley Fraser", amount: 610_000, closingDate: "2026-12-15", assigned: me, purpose: "Purchase" },
  ],
  Submitted: [
    { name: "Drew Patel", amount: 480_000, closingDate: "2026-12-01", submittedDate: "2026-10-20", assigned: me, purpose: "Refinance" },
    { name: "Jamie Wilson", amount: 390_000, closingDate: "2026-11-28", submittedDate: "2026-10-22", assigned: me, purpose: "Switch/Transfer" },
  ],
  Approved: [
    { name: "Avery Clarke", amount: 430_000, closingDate: "2026-11-20", conditionsDate: "2026-11-06", assigned: me, purpose: "Purchase" },
  ],
  Accepted: [],
  "Waiting to Close": [
    { name: "Quinn Roberts", amount: 520_000, closingDate: "2026-11-14", assigned: me, purpose: "Purchase" },
    { name: "Reese Martin", amount: 370_000, closingDate: "2026-11-18", assigned: me, purpose: "Refinance" },
  ],
  "Funded + Awaiting Payment": [
    { name: "Hayden Scott", amount: 455_000, closingDate: "2026-10-09", assigned: me, purpose: "Purchase" },
  ],
  Declined: [{ name: "Parker Hughes", amount: 300_000, assigned: me, purpose: "Refinance" }],
  Cancelled: [
    { name: "Emerson Kim", amount: 410_000, assigned: me, purpose: "Purchase" },
    { name: "Rowan Diaz", amount: 280_000, assigned: me, purpose: "Renewal" },
  ],
};

// The single made-up deal behind every /deal page. Values are keyed by field label.
export const placeholderDeal = {
  number: "KW-100001",
  clients: ["Jordan Lee", "Casey Lee"],
  gds: "29.80",
  tds: "36.40",
  ltv: "80.00",
  netWorth: "$245,000",
  status: "New Deal",
  closing: "2026-12-15",
  conditions: "2026-11-30",
  values: {
    "Applicant Type": "Primary", Salutation: "Mr.", "First Name": "Jordan", "Last Name": "Lee",
    Email: "jordan.lee@example.com", "Cell Phone": "555-0142", "Contact Preference": "Email", DOB: "1988-04-12",
    Language: "English", "Marital Status": "Married", Spouse: "Casey Lee", Dependents: "1", "First Time Buyer": "Yes",
    Residency: "Canadian Citizen", "Employment Status": "Current", "Company Name": "Northwind Analytics",
    "Job Title": "Data Analyst", "Job Type": "Full Time", "Employment Type": "Salaried", "Time Worked": "6 yrs",
    "Income Type": "Salary", "Income Period": "Annually", "Industry Sector": "Technology",
    "Total Assets": "$310,000", "Total Liabilities": "$65,000", "Net Worth": "$245,000",
    "Street #": "100", "Street Name": "Maple", "Street Type": "Avenue", City: "Sampletown", Province: "Ontario",
    "Postal Code": "A1A 1A1", "Occupied By": "Owner", Purpose: "Owner Occupied", "Construction Type": "Existing",
    "Dwelling Type": "Detached", "Dwelling Style": "Two Storey", Tenure: "Freehold", "Heating Type": "Forced Air",
    "Water Info": "Municipal", "Sewage Info": "Municipal", "Year Built": "2004", "# of Units": "1",
    "Annual Taxes": "$4,200", "Tax Year": "2026", "Paid By": "Borrower", "Heating Cost": "$100",
    "Purchase Price": "$812,500", "Estimated Value": "$812,500",
    "Application Type": "Purchase", "Mortgage Type": "Standard", "Loan Type": "Mortgage", "Application Purpose": "Purchase",
    "Down Payment": "$162,500", "1st Mortgage Total": "$650,000", "Total Mortgage Amount with Premium": "$650,000",
    "Interest Rate": "4.79%", "Net Rate": "4.79%", "Rate Type": "Fixed", "Term Type": "Closed", "Payment Frequency": "Monthly",
    "Compounded Period": "Semi-Annually", Term: "5 Years", Amortization: "25 Years", "Total Loan Amount": "$650,000",
    "Monthly Payment": "$3,700.12", Payment: "$3,700.12", "Qualifying Rate": "6.79%", "Qualifying Payment": "$4,450.30",
    "Estimated Property Taxes": "$350.00", "Mortgage Payment": "$3,700.12", "First Payment": "2027-01-15",
    "Maturity Date": "2031-12-15", "Total Payment": "$4,050.12", Agent: me, "Submission Agent": me,
    "Closing Date": "2026-12-15", Lender: "Sample Bank", Product: "5 Yr Fixed", "Mortgage Amount": "$650,000",
    "Charge Type": "First",
  } as Record<string, string>,
  tables: {
    Reminders: [["Nov-03-2026", "Follow up on outstanding documents", me, ""]],
    "Deal Specific Tasks": [
      ["Nov-05-2026", "Collect recent pay stubs", me, "Mark as Not Required"],
      ["Nov-12-2026", "Order appraisal", me, "Mark as Not Required"],
    ],
    "Pinned Notes": [["Oct-20-2026", "Prefers contact by email.", "amorgan"]],
    Notes: [["Oct-20-2026", "Intro call completed. Placeholder note.", "amorgan", ""]],
    "Lender Conditions And Documents": [
      ["Letter of employment", "Not received", "Outstanding"],
      ["Agreement of purchase and sale", "Received", "Met"],
    ],
    Lenders: [["Sample Bank", "5 Yr Fixed", "Purchase", "Mortgage", "Fixed", "5 Years", "4.79%", "", ""]],
    "System Email History": [["Oct-21-2026", "Application received", "noreply@example.com", "jordan.lee@example.com"]],
  } as Record<string, string[][]>,
};

export type Contact = {
  id: number | string; // string = database uuid, number = placeholder
  firstName: string;
  lastName: string;
  homePhone?: string;
  cellPhone?: string;
  workPhone?: string;
  email?: string;
  address?: string;
  previousOne?: string;
  previousTwo?: string;
  casl: boolean;
  merged?: Contact[];
};

export const placeholderContacts: Contact[] = [
  { id: 1, firstName: "Avery", lastName: "Clarke", cellPhone: "(555) 010-3001", email: "avery.clarke@example.com", address: "12 Sample St, Toronto, ON", casl: true },
  { id: 2, firstName: "Casey", lastName: "Nguyen", homePhone: "(555) 010-3002", cellPhone: "(555) 010-3003", email: "casey.nguyen@example.com", address: "48 Placeholder Ave, Ottawa, ON", previousOne: "9 Demo Rd, Ottawa, ON", casl: true },
  { id: 3, firstName: "Drew", lastName: "Patel", cellPhone: "(555) 010-3004", email: "drew.patel@example.com", address: "301 Example Blvd, Mississauga, ON", casl: false },
  { id: 4, firstName: "Hayden", lastName: "Ross", workPhone: "(555) 010-3005", email: "hayden.ross@example.com", address: "77 Test Cres, Hamilton, ON", casl: true,
    merged: [{ id: 41, firstName: "Hayden", lastName: "Ross", cellPhone: "(555) 010-3006", casl: false }] },
  { id: 5, firstName: "Jamie", lastName: "Wilson", cellPhone: "(555) 010-3007", address: "5 Mock Lane, London, ON", casl: false },
  { id: 6, firstName: "Jordan", lastName: "Lee", homePhone: "(555) 010-3008", cellPhone: "(555) 010-3009", email: "jordan.lee@example.com", address: "220 Fictional Way, Toronto, ON", previousOne: "14 Old Demo St, Toronto, ON", previousTwo: "3 Former Ct, Barrie, ON", casl: true },
  { id: 7, firstName: "Morgan", lastName: "Shaw", cellPhone: "(555) 010-3010", email: "morgan.shaw@example.com", casl: true },
  { id: 8, firstName: "Priya", lastName: "Shah", cellPhone: "(555) 010-3011", email: "priya.shah@example.com", address: "88 Sample Pkwy, Markham, ON", casl: false },
  { id: 9, firstName: "Sam", lastName: "Carter", homePhone: "(555) 010-3012", email: "sam.carter@example.com", casl: true },
];

export const placeholderParked = [
  { id: 1, firstName: "Priya", lastName: "Shah", dealNumber: "KW-100021", address: "88 Sample Pkwy, Markham, ON", closingDate: "2026-12-15", conditionsDate: "2026-12-01" },
  { id: 2, firstName: "Hayden", lastName: "Ross", dealNumber: "KW-100022", address: "77 Test Cres, Hamilton, ON", closingDate: "2027-01-20", conditionsDate: "2027-01-06" },
  { id: 3, firstName: "Jamie", lastName: "Wilson", dealNumber: "KW-100023", address: "5 Mock Lane, London, ON", closingDate: "2027-02-28", conditionsDate: "2027-02-14" },
];

// Screens not yet backed by the database start empty instead of showing made-up rows.
export type HistoricalDeal = { id: number; loanCode: string; name: string; closingDate: string; maturityDate: string; lender: string; rate: number; status: string; appType: "Pre-Approval" | "Approval"; casl: boolean };
export const placeholderHistorical: HistoricalDeal[] = [];

export const placeholderDuplicates: { name: string; rows: Contact[] }[] = [];

export type Message = { id: number; title: string; to: string; importance: "Important" | "Warning" | "System" | "Share"; read: boolean; sent: string; from: string; body: string; loanCode?: string; draft?: boolean };
export const placeholderMessages: Message[] = [];

export type NewApp = { id: number; office: string; firstName: string; lastName: string; amount: number; closingDate: string; conditionsDate: string; entryDate: string; source: string };
export const placeholderNewApps: NewApp[] = [];

export type Workflow = { id: number; stage: string; title: string; assignee: string; time: string; trigger: string; action: string; active: boolean; createdBy: string; for: string };
export const placeholderWorkflows: Workflow[] = [];

export const reports = [
  { slug: "build", title: "Build a Report" },
  { slug: "one-touch", title: "One-Touch Reports" },
  { slug: "production", title: "Production Reports" },
  { slug: "pipeline", title: "Pipeline Report" },
  { slug: "sla", title: "SLA Report" },
  { slug: "credit-bureau", title: "Credit Bureau Report" },
  { slug: "borrower-risk", title: "Borrower Risk Assessment" },
  { slug: "sanction-screening", title: "Borrower Sanction Screening" },
] as const;


export const domainStatuses = ["Pending", "Active", "Inactive", "Declined"];

export type Domain = { id: number; name: string; status: string; createdOn: string; statusSetOn: string; azure: boolean; history: { date: string; status: string; note: string }[]; accounts: { user: string; email: string; date: string; member: string; status: string }[] };
export const placeholderDomains: Domain[] = [];

export const webhookStatuses = ["Pending Approval", "Active", "Declined", "Revoked", "Deactivated"];

export type Webhook = { key: string; name: string; status: string; created: string; callbackUrl: string; count: number; last: string };
export const placeholderWebhooks: Webhook[] = [];
export const placeholderWebhookTx: { id: number; key: string; created: string; request: string; response: string; statusCode: number; attempt: number; json: Record<string, string> }[] = [];
