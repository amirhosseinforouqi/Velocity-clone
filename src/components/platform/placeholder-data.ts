// Placeholder values only — no real user or client data from Velocity.
export const placeholder = {
  userName: "Alex Morgan",
  dealNumber: "KW-100001",
  activeDeals: 9,
  cancelledDeals: 2,
  stages: {
    leads: { count: 8 },
    preApproval: { count: 3, amount: 1_275_000 },
    pipeline: { count: 4, amount: 1_960_000 },
    wtc: { count: 2, amount: 890_000 },
    funded: { count: 6, amount: 2_730_000 },
  },
  crm: [
    { label: "Pre-Approvals", count: 3, color: "#30718f" },
    { label: "Birthdays", count: 5, color: "#12a4a1" },
    { label: "Anniversaries", count: 2, color: "#1563c5" },
    { label: "Maturities", count: 4, color: "#0092e7" },
  ],
};

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

const me = placeholder.userName;

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
  number: placeholder.dealNumber,
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

export type MyDayTask = { type: "phone" | "sms" | "email" | "other"; title: string; loanCode: string; status: string; recipient: string; contact: string };

export const placeholderTasks: MyDayTask[] = [
  { type: "phone", title: "Welcome call", loanCode: "KW-100003", status: "New Deal", recipient: "Jordan Lee", contact: "(555) 010-2001" },
  { type: "phone", title: "Rate hold reminder", loanCode: "KW-100005", status: "Pre-Approval", recipient: "Morgan Shaw", contact: "(555) 010-2002" },
  { type: "sms", title: "Documents reminder", loanCode: "KW-100008", status: "Submitted", recipient: "Drew Patel", contact: "(555) 010-2003" },
  { type: "email", title: "Approval congratulations", loanCode: "KW-100002", status: "Approved", recipient: "Avery Clarke", contact: "avery.clarke@example.com" },
  { type: "email", title: "Closing checklist", loanCode: "KW-100011", status: "Waiting to Close", recipient: "Hayden Ross", contact: "hayden.ross@example.com" },
  { type: "other", title: "Order appraisal", loanCode: "KW-100009", status: "Accepted", recipient: "Jamie Wilson", contact: "(555) 010-2004" },
];

// Calendar types match Velocity's drag-to-add list.
export type EventType = "phone" | "envelope" | "bookmark" | "bell" | "star";
export type CalendarEvent = { id: number; type: EventType; title: string; start: string; allDay?: boolean; contact?: string; loanCode?: string };

export const placeholderEvents: CalendarEvent[] = [
  { id: 1, type: "phone", title: "Call Jordan Lee", start: "2026-10-27T10:00", contact: "Jordan Lee", loanCode: "KW-100003" },
  { id: 2, type: "bell", title: "Appointment - Casey Nguyen", start: "2026-10-27T14:30", contact: "Casey Nguyen", loanCode: "KW-100004" },
  { id: 3, type: "envelope", title: "Email Avery Clarke", start: "2026-10-28T09:00", contact: "Avery Clarke", loanCode: "KW-100002" },
  { id: 4, type: "bookmark", title: "Followup - Drew Patel", start: "2026-10-30", allDay: true, contact: "Drew Patel", loanCode: "KW-100008" },
  { id: 5, type: "star", title: "Team lunch", start: "2026-10-23T12:00" },
  { id: 6, type: "bookmark", title: "Closing - Hayden Ross", start: "2026-11-09", allDay: true, contact: "Hayden Ross", loanCode: "KW-100011" },
  { id: 7, type: "phone", title: "Call Morgan Shaw", start: "2026-10-14T11:00", contact: "Morgan Shaw", loanCode: "KW-100005" },
  { id: 8, type: "bookmark", title: "Closing - Avery Clarke", start: "2026-11-20", allDay: true, contact: "Avery Clarke", loanCode: "KW-100002" },
];

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

// Groups of likely duplicates for Contacts > Merge.
export const placeholderDuplicates: { name: string; rows: Contact[] }[] = [
  { name: "Jordan Lee", rows: [placeholderContacts[5], { id: 61, firstName: "Jordan", lastName: "Lee", cellPhone: "(555) 010-3009", casl: false }, { id: 62, firstName: "Jordan", lastName: "Lee", email: "jordan.lee@example.com", casl: false }] },
  { name: "Priya Shah", rows: [placeholderContacts[7], { id: 81, firstName: "Priya", lastName: "Shah", cellPhone: "(555) 010-3011", casl: false }] },
  { name: "Sam Carter", rows: [placeholderContacts[8], { id: 91, firstName: "Samuel", lastName: "Carter", email: "sam.carter@example.com", casl: false }] },
];

// Sidebar "Previous Deals": recently opened deals.
export const placeholderRecentDeals = [
  { loanCode: "KW-100001", name: "Jordan Lee" },
  { loanCode: "KW-100002", name: "Casey Nguyen" },
  { loanCode: "KW-100003", name: "Avery Clarke" },
  { loanCode: "KW-100004", name: "Hayden Ross" },
  { loanCode: "KW-100005", name: "Morgan Shaw" },
];

export const placeholderAgents = [placeholder.userName, "Taylor Brooks", "Riley Chen"];

export const placeholderLenders = {
  "Prime Lenders:": ["Sample Bank", "Example Trust", "Demo Credit Union"],
  "Alternative Lenders:": ["Placeholder Mortgage Co.", "Test Capital"],
  "Other Lenders:": ["Private Lender", "Other"],
};

export type HistoricalDeal = { id: number; loanCode: string; name: string; closingDate: string; maturityDate: string; lender: string; rate: number; status: string; appType: "Pre-Approval" | "Approval"; casl: boolean };

export const placeholderHistorical: HistoricalDeal[] = [
  { id: 1, loanCode: "KW-090011", name: "Avery Clarke", closingDate: "2021-06-30", maturityDate: "2026-06-30", lender: "Sample Bank", rate: 2.14, status: "Complete", appType: "Approval", casl: true },
  { id: 2, loanCode: "KW-090012", name: "Drew Patel", closingDate: "2021-09-15", maturityDate: "2026-09-15", lender: "Example Trust", rate: 2.39, status: "Paid", appType: "Approval", casl: false },
  { id: 3, loanCode: "KW-090013", name: "Jamie Wilson", closingDate: "2022-02-01", maturityDate: "2027-02-01", lender: "Demo Credit Union", rate: 3.05, status: "Closed", appType: "Approval", casl: false },
  { id: 4, loanCode: "KW-090014", name: "Casey Nguyen", closingDate: "2022-05-20", maturityDate: "2025-05-20", lender: "Test Capital", rate: 4.49, status: "Complete", appType: "Approval", casl: true },
  { id: 5, loanCode: "KW-090015", name: "Morgan Shaw", closingDate: "2023-01-10", maturityDate: "2026-01-10", lender: "Sample Bank", rate: 5.24, status: "Cancelled", appType: "Pre-Approval", casl: true },
  { id: 6, loanCode: "KW-090016", name: "Sam Carter", closingDate: "2023-08-31", maturityDate: "2028-08-31", lender: "Placeholder Mortgage Co.", rate: 5.89, status: "Declined", appType: "Pre-Approval", casl: true },
];

export const placeholderParked = [
  { id: 1, firstName: "Priya", lastName: "Shah", dealNumber: "KW-100021", address: "88 Sample Pkwy, Markham, ON", closingDate: "2026-12-15", conditionsDate: "2026-12-01" },
  { id: 2, firstName: "Hayden", lastName: "Ross", dealNumber: "KW-100022", address: "77 Test Cres, Hamilton, ON", closingDate: "2027-01-20", conditionsDate: "2027-01-06" },
  { id: 3, firstName: "Jamie", lastName: "Wilson", dealNumber: "KW-100023", address: "5 Mock Lane, London, ON", closingDate: "2027-02-28", conditionsDate: "2027-02-14" },
];

export const placeholderOffices = ["Toronto Office", "Ottawa Office"];

// Rows behind every report; derived from the placeholder contacts.
export const placeholderReportDeals = placeholderContacts.map((c, i) => ({
  loanCode: `KW-1001${String(i).padStart(2, "0")}`,
  client: `${c.firstName} ${c.lastName}`,
  status: ["New", "Submitted", "Approved", "Accepted", "Waiting To Close", "Funded", "Complete", "Funded", "Declined"][i],
  amount: 350_000 + i * 85_000,
  lender: Object.values(placeholderLenders).flat()[i % 7],
  product: ["5 Year Fixed", "5 Year Variable", "3 Year Fixed", "HELOC"][i % 4],
  closingDate: `2026-${String((i % 12) + 1).padStart(2, "0")}-${String(10 + i).padStart(2, "0")}`,
  agent: placeholderAgents[i % 3],
  office: placeholderOffices[i % 2],
  birthday: `19${70 + i}-${String((i % 12) + 1).padStart(2, "0")}-15`,
  risk: (["Low", "Medium", "High", "None"] as const)[i % 4],
  screening: (["Cleared", "Cleared", "Rejected", "Not Screened"] as const)[i % 4],
  bureau: (["Equifax", "TransUnion"] as const)[i % 2],
  joint: i % 3 === 0,
}));

export type Message = { id: number; title: string; to: string; importance: "Important" | "Warning" | "System" | "Share"; read: boolean; sent: string; from: string; body: string; loanCode?: string; draft?: boolean };

export const placeholderMessages: Message[] = [
  { id: 1, title: "Document uploaded: Pay Stub", to: placeholder.userName, importance: "Important", read: false, sent: "2026-10-26T09:14", from: "Client Portal", body: "Avery Clarke uploaded a document for the condition Pay Stub.", loanCode: "KW-100003" },
  { id: 2, title: "SMS reply received", to: placeholder.userName, importance: "Share", read: false, sent: "2026-10-25T16:40", from: "Taylor Brooks", body: "Casey Nguyen replied: \"Thanks, I will send the documents tonight.\"", loanCode: "KW-100002" },
  { id: 3, title: "Deal status changed to Approved", to: placeholder.userName, importance: "System", read: true, sent: "2026-10-23T11:02", from: "Keyway", body: "Deal KW-100001 moved from Submitted to Approved.", loanCode: "KW-100001" },
  { id: 4, title: "Rate hold expiring", to: placeholder.userName, importance: "Warning", read: true, sent: "2026-10-20T08:30", from: "Keyway", body: "The pre-approval rate hold for Hayden Ross expires in 5 days.", loanCode: "KW-100004" },
];

export const placeholderNewApps = [
  { id: 1, office: "Toronto Office", firstName: "Riley", lastName: "Morgan", amount: 520_000, closingDate: "2027-01-15", conditionsDate: "2026-12-30", entryDate: "2026-10-26", source: "Online App" },
  { id: 2, office: "Toronto Office", firstName: "Quinn", lastName: "Harper", amount: 385_000, closingDate: "2026-12-20", conditionsDate: "2026-12-06", entryDate: "2026-10-24", source: "Client Experience" },
  { id: 3, office: "Ottawa Office", firstName: "Skyler", lastName: "Grant", amount: 710_000, closingDate: "2027-02-28", conditionsDate: "2027-02-10", entryDate: "2026-10-21", source: "Client Journey" },
];

export const placeholderReminders = [
  { id: 1, type: "Urgent", firstName: "Jordan", lastName: "Lee", amount: 640_000, closingDate: "2026-11-02", conditionsDate: "2026-10-28", loanCode: "KW-100001" },
  { id: 2, type: "Warning", firstName: "Casey", lastName: "Nguyen", amount: 455_000, closingDate: "2026-11-18", conditionsDate: "2026-11-04", loanCode: "KW-100002" },
  { id: 3, type: "Notice", firstName: "Morgan", lastName: "Shaw", amount: 298_000, closingDate: "2026-12-09", conditionsDate: "2026-11-25", loanCode: "KW-100005" },
];

export type Workflow = { id: number; stage: string; title: string; assignee: string; time: string; trigger: string; action: string; active: boolean; createdBy: string; for: string };

export const placeholderWorkflows: Workflow[] = [
  { id: 1, stage: "New Deal", title: "Welcome email", assignee: placeholder.userName, time: "Immediately", trigger: "Deal Status: New", action: "Send Email", active: true, createdBy: placeholder.userName, for: "User" },
  { id: 2, stage: "New Deal", title: "Request documents", assignee: placeholder.userName, time: "1 day after", trigger: "Deal Status: New", action: "Create Task", active: true, createdBy: placeholder.userName, for: "User" },
  { id: 3, stage: "Approved", title: "Congratulations SMS", assignee: "Taylor Brooks", time: "Immediately", trigger: "Deal Status: Approved", action: "Send SMS", active: true, createdBy: placeholder.userName, for: "Office" },
  { id: 4, stage: "Funded", title: "Closing gift reminder", assignee: placeholder.userName, time: "7 days after", trigger: "Deal Status: Funded", action: "Create Reminder", active: false, createdBy: placeholder.userName, for: "User" },
  { id: 5, stage: "", title: "Birthday wishes", assignee: placeholder.userName, time: "On date", trigger: "Contact Birthday", action: "Send Email", active: true, createdBy: placeholder.userName, for: "User" },
];

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

// Admin and support screens.
export type AdminOffice = { id: number; name: string; nickname: string; streetNumber: string; streetName: string; city: string; province: string; postalCode: string; phone: string; email: string; license: string };

export const placeholderAdminOffices: AdminOffice[] = [
  { id: 1, name: "Toronto Office", nickname: "TOR", streetNumber: "100", streetName: "Example St", city: "Toronto", province: "ON", postalCode: "A1A 1A1", phone: "(555) 010-1000", email: "toronto@example.com", license: "10000" },
  { id: 2, name: "Ottawa Office", nickname: "OTT", streetNumber: "200", streetName: "Sample Ave", city: "Ottawa", province: "ON", postalCode: "B2B 2B2", phone: "(555) 010-2000", email: "ottawa@example.com", license: "10001" },
];

export const roles = ["Super Admin", "Organization", "Brokerage Admin", "Office Admin", "Sub Office", "Team", "Broker", "Agent", "Associate", "Assistant"];

export type AdminUser = { id: number; firstName: string; lastName: string; userName: string; email: string; office: string; role: string; member: string; associates: string[]; isAgent: boolean; erd: boolean; erdId: string; externalId: string; removed: boolean };

export const placeholderAdminUsers: AdminUser[] = [
  { id: 1, firstName: "Alex", lastName: "Morgan", userName: "amorgan", email: "alex.morgan@example.com", office: "Toronto Office", role: "Brokerage Admin", member: "amorgan", associates: ["Riley Chen"], isAgent: true, erd: true, erdId: "ERD-0001", externalId: "N-0001", removed: false },
  { id: 2, firstName: "Taylor", lastName: "Brooks", userName: "tbrooks", email: "taylor.brooks@example.com", office: "Toronto Office", role: "Agent", member: "tbrooks", associates: [], isAgent: true, erd: false, erdId: "", externalId: "N-0002", removed: false },
  { id: 3, firstName: "Riley", lastName: "Chen", userName: "rchen", email: "riley.chen@example.com", office: "Ottawa Office", role: "Assistant", member: "rchen", associates: [], isAgent: false, erd: false, erdId: "", externalId: "N-0003", removed: false },
  { id: 4, firstName: "Jordan", lastName: "Lee", userName: "jlee", email: "jordan.lee@example.com", office: "Ottawa Office", role: "Agent", member: "jlee", associates: [], isAgent: true, erd: false, erdId: "", externalId: "N-0004", removed: true },
];

export const logTypes = ["All Logs", "Link Logs", "eSign Logs", "Compliance Package Logs", "Historical Deal Logs", "Connect Compliance Logs"];

export const placeholderLogs = [
  { id: 1, type: "Link Logs", fileName: "link_KW-100001.log", tags: "submit, lender", created: "2026-10-20 09:14", updated: "2026-10-20 09:15", db: true },
  { id: 2, type: "eSign Logs", fileName: "esign_KW-100002.log", tags: "esign, envelope", created: "2026-10-21 13:02", updated: "2026-10-21 13:40", db: false },
  { id: 3, type: "Compliance Package Logs", fileName: "compliance_KW-100003.log", tags: "package", created: "2026-10-22 16:30", updated: "2026-10-22 16:31", db: true },
  { id: 4, type: "Historical Deal Logs", fileName: "historical_KW-090011.log", tags: "restore", created: "2026-10-23 11:05", updated: "2026-10-23 11:05", db: false },
  { id: 5, type: "Connect Compliance Logs", fileName: "connect_KW-100004.log", tags: "fsra", created: "2026-10-24 08:47", updated: "2026-10-24 08:52", db: true },
];

export const domainStatuses = ["Pending", "Active", "Inactive", "Declined"];

export const placeholderDomains = [
  { id: 1, name: "example.com", status: "Active", createdOn: "2026-03-01", statusSetOn: "2026-03-04", azure: true, history: [{ date: "2026-03-04", status: "Active", note: "Azure settings verified." }], accounts: [{ user: "amorgan", email: "alex.morgan@example.com", date: "2026-03-05", member: "amorgan", status: "Active" }] },
  { id: 2, name: "sample-mortgage.com", status: "Pending", createdOn: "2026-10-01", statusSetOn: "2026-10-01", azure: false, history: [], accounts: [] },
];

export const webhookStatuses = ["Pending Approval", "Active", "Declined", "Revoked", "Deactivated"];

export const placeholderWebhooks = [
  { key: "wh-demo-0001", name: "Sample CRM Sync", status: "Active", created: "2026-05-12", callbackUrl: "https://hooks.example.com/keyway", count: 3, last: "2026-10-26 14:22" },
  { key: "wh-demo-0002", name: "Test Lead Router", status: "Pending Approval", created: "2026-10-18", callbackUrl: "https://example.org/webhook", count: 0, last: "" },
];

export const placeholderWebhookTx = [1, 2, 3].map((n) => ({
  id: n, key: "wh-demo-0001", created: `2026-10-2${n + 3} 14:2${n}`, request: `2026-10-2${n + 3} 14:2${n}:01`, response: `2026-10-2${n + 3} 14:2${n}:02`, statusCode: n === 2 ? 500 : 200, attempt: n === 2 ? 2 : 1,
  json: { event: "deal.statusChanged", loanCode: `KW-10000${n}`, status: "Submitted" },
}));
