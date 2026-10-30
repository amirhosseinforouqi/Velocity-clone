// What a contact is to the business (RevoDoc's role list). No imports, so client components can use it.
export const contactRoles = [
  "Accountant", "Advertisement", "Appraiser", "Banker", "BDM", "Builder", "Call In", "Client", "Co-Agent", "Co-Broker", "Construction Company",
  "Credit Admin", "Creditor Insurance", "Developer", "Engineer", "Environmental", "Financial Planner", "Fulfillment Officer", "Home Inspector",
  "Insurance Advisor", "Investor", "Lawyer", "Lender", "Mortgage Broker", "Online", "Other", "Private Lender", "Promo", "Real Estate Agent",
  "Referral Source", "Surveyor", "Underwriter", "Walk In", "Website",
] as const;

export const isContactRole = (v: unknown): v is (typeof contactRoles)[number] => (contactRoles as readonly unknown[]).includes(v);
