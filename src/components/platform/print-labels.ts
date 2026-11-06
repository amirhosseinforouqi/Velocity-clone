import type { DealStatus } from "@/server/deal-status";

// French for the printed application (Print Application (Fr)): page chrome, section / group titles and field labels.
// Values typed into the deal (names, select choices) print as entered, except Yes / No.
export const frChrome = {
  title: "Demande de prêt hypothécaire", deal: "Dossier", status: "Statut", agent: "Agent", applicants: "Demandeurs",
  printed: "Imprimé le", print: "Imprimer", empty: "Aucun renseignement saisi.", yes: "Oui", no: "Non",
};
export const enChrome = {
  title: "Mortgage Application", deal: "Deal", status: "Status", agent: "Agent", applicants: "Applicants",
  printed: "Printed", print: "Print", empty: "Nothing entered yet.", yes: "Yes", no: "No",
};

export const frStatus: Record<DealStatus, string> = {
  lead: "Piste", pre_approval: "Préapprobation", new_deal: "Nouveau dossier", submitted: "Soumis", approved: "Approuvé",
  accepted: "Accepté", waiting_to_close: "En attente de clôture", funded: "Financé", complete: "Terminé", declined: "Refusé",
  parked: "En suspens", cancelled: "Annulé",
};

const fr: Record<string, string> = {
  // Sections
  "Assets & Properties": "Actifs et propriétés", "Conditions & Documents": "Conditions et documents", "Subject Property Details": "Propriété visée",
  "Mortgage Request": "Demande hypothécaire", Borrowers: "Emprunteurs", Referral: "Recommandation", Insurance: "Assurance",
  "Close-Out Process": "Clôture du dossier",
  // Groups
  Totals: "Totaux", Property: "Propriété", "Property Totals": "Totaux des propriétés", Compliance: "Conformité", Address: "Adresse",
  Details: "Détails", "Mortgage Breakdown": "Répartition du prêt", "File and Lender Details": "Dossier et prêteur", Improvements: "Rénovations",
  "Rates and Payments": "Taux et versements", "Qualifying Details": "Admissibilité", "Payment Summary": "Sommaire des versements",
  Lenders: "Prêteurs", "Lender Submission": "Soumission au prêteur", "Co Broker": "Co-courtier", "Co-Broker": "Co-courtier",
  Applicant: "Demandeur", Residency: "Résidence", Employment: "Emploi", "Other Income": "Autres revenus",
  "Referral Source Contacts": "Sources de recommandation", Commissions: "Commissions", "Close-Out Summary": "Sommaire de clôture",
  // Fields
  "Total Assets": "Total des actifs", "Total Liabilities": "Total des passifs", "Net Worth": "Valeur nette", "Who owns it": "Propriétaire",
  Occupancy: "Occupation", "Property Value": "Valeur de la propriété", "Original Date": "Date d'acquisition", "Original Price": "Prix d'acquisition",
  "Future Status": "Statut futur", "Annual Taxes": "Taxes annuelles", "Condo Fees": "Frais de copropriété", "Fees Incl. Heat": "Frais incl. chauffage",
  "Calculate Condo Fees @100%": "Frais de copropriété à 100 %", "Include in TDS": "Inclure dans l'ABD", "Property Equity": "Avoir propre",
  "Rental Income": "Revenu de location", "Rental Income Options": "Options de revenu de location", "Rental Add/Offset": "Ajout / compensation locative",
  Hydro: "Électricité", "Heating Cost": "Coût de chauffage", Management: "Gestion", Repairs: "Réparations", Interest: "Intérêts", Other: "Autre",
  "Mortgage Type": "Type de prêt", "Mortgage Holder": "Créancier hypothécaire", "Mortgage #": "No de prêt", Balance: "Solde", Payment: "Versement",
  "Payment Frequency": "Fréquence des versements", "Maturity Date": "Date d'échéance", "Rate Type": "Type de taux", "Interest Rate": "Taux d'intérêt",
  "Term Type": "Type de terme", "Original Mtg Amount": "Montant initial du prêt", "Blended Amortization": "Amortissement combiné", Insured: "Assuré",
  Insurer: "Assureur", "Insurance Account#": "No de compte d'assurance", Payoff: "Remboursement", Mortgages: "Prêts hypothécaires",
  Payments: "Versements", Expenses: "Dépenses", "Rental Expenses": "Dépenses locatives", "Lender Conditions Met": "Conditions du prêteur remplies",
  "Unit #": "No d'unité", "Street #": "No civique", "Street Name": "Nom de rue", "Street Type": "Type de rue", Direction: "Orientation",
  City: "Ville", Province: "Province", "Postal Code": "Code postal", "Occupied By": "Occupée par", Purpose: "Usage prévu",
  "Legal Description": "Désignation cadastrale", "PID/PIN/Block": "NID / lot", "Conc/Township": "Concession / canton", "MLS Listed": "Inscrite MLS",
  "MLS #": "No MLS", "Construction Type": "Type de construction", "Dwelling Type": "Type d'habitation", "Dwelling Style": "Style d'habitation",
  Tenure: "Mode de tenure", "Living Space": "Superficie habitable", "Lot Size": "Superficie du terrain", "Heating Type": "Type de chauffage",
  "Water Info": "Alimentation en eau", "Sewage Info": "Égouts", Usage: "Utilisation", "# of Units": "Nombre d'unités", "Year Built": "Année de construction",
  "Garage Size": "Taille du garage", "Garage Type": "Type de garage", "Environmental Hazard": "Risque environnemental", Zoning: "Zonage",
  "Tax Year": "Année d'imposition", "Paid By": "Payé par", "Purchase Price": "Prix d'achat", "Estimated Value": "Valeur estimée",
  "Appraisal Value": "Valeur d'évaluation", "Appraisal Date": "Date d'évaluation", "Total Expenses": "Total des dépenses",
  "Application Type": "Type de demande", "Loan Type": "Type de prêt", "Application Purpose": "Objet de la demande", Program: "Programme",
  "Down Payment": "Mise de fonds", "1st Mortgage Total": "Total 1re hypothèque", "2nd Mortgage Total": "Total 2e hypothèque",
  "3rd Mortgage Total": "Total 3e hypothèque", "Insurer Ref": "Réf. de l'assureur", "Premium Rate": "Taux de prime",
  "Mtg Ins Premium": "Prime d'assurance prêt", "Total Mortgage Amount with Premium": "Montant total du prêt avec prime",
  "LOC Repayment Type": "Remboursement de la marge", "Broker File #": "No de dossier du courtier", "Origination File #": "No de dossier d'origine",
  "Lender Ref #": "Réf. du prêteur", "Credit Tier": "Catégorie de crédit", "Rate Hold Days": "Jours de garantie de taux",
  "Rate Hold Expiry": "Fin de la garantie de taux", "Lender Commitment": "Engagement du prêteur", "Discount Rate": "Taux d'escompte",
  "Buydown Rate": "Taux de rachat", "Net Rate": "Taux net", "Variable To Prime": "Écart avec le taux préférentiel",
  "Compounded Period": "Période de capitalisation", Term: "Terme", Amortization: "Amortissement", "Amortization Months": "Amortissement (mois)",
  "Total Loan Amount": "Montant total du prêt", "Monthly Payment": "Versement mensuel", "Qualifying Rate": "Taux d'admissibilité",
  "Qualifying Compounded Period": "Capitalisation d'admissibilité", "Qualifying Amortization": "Amortissement d'admissibilité",
  "Qualifying Payment": "Versement d'admissibilité", "Estimated Property Taxes": "Taxes foncières estimées", "IAD Date": "Date de rajustement des intérêts",
  "IAD Amount": "Montant de rajustement des intérêts", "Mortgage Payment": "Versement hypothécaire", "First Payment": "Premier versement",
  "MPP Insurance Payment": "Assurance protection de prêt", "Other Insurance": "Autre assurance", "Total Payment": "Versement total",
  Agent: "Agent", "Submission Agent": "Agent de soumission", "Line Of Business": "Secteur d'activité", "Co Agent": "Co-agent",
  "Submission Note": "Note de soumission", "Applicant Type": "Type de demandeur", "Relationship to Primary": "Lien avec le demandeur principal",
  Salutation: "Civilité", "First Name": "Prénom", Initial: "Initiale", "Last Name": "Nom", Suffix: "Suffixe", Email: "Courriel",
  "Home Phone": "Téléphone (domicile)", "Cell Phone": "Cellulaire", "Work Phone": "Téléphone (travail)", Fax: "Télécopieur",
  "Contact Preference": "Mode de contact préféré", DOB: "Date de naissance", SIN: "NAS", Language: "Langue", "Marital Status": "État civil",
  Spouse: "Conjoint", Dependents: "Personnes à charge", "First Time Buyer": "Premier acheteur", "Resided in Canada": "Résidence au Canada",
  "Immigration Status": "Statut d'immigration", "Arrival Date": "Date d'arrivée", "Is Holding Company": "Société de portefeuille",
  "Holding Company Name": "Nom de la société de portefeuille", "Employment Status": "Situation d'emploi", "Company Name": "Nom de l'entreprise",
  "Self Employed": "Travailleur autonome", "Company Type": "Type d'entreprise", "Operating As": "Faisant affaire sous",
  "Gross Revenue": "Revenu brut", "Pays Self": "Se verse un salaire", T4: "T4", "Business Income": "Revenu d'entreprise", Dividends: "Dividendes",
  Commission: "Commission", "Job Title": "Poste", "Job Type": "Type d'emploi", "Time Worked": "Ancienneté", "Employment Type": "Type d'emploi",
  "Industry Sector": "Secteur d'activité", "Income Type": "Type de revenu", "Income Period": "Période de revenu", "Receives Benefits": "Reçoit des avantages",
  "Includes Variable Income": "Inclut un revenu variable", "Additional Income": "Revenu supplémentaire", "Additional Income Amount": "Montant du revenu supplémentaire",
  "Time in Industry": "Années dans le secteur", "Employer Phone": "Téléphone de l'employeur", "Employer Address": "Adresse de l'employeur",
  "Referral Type": "Type de recommandation", "Other Type": "Autre type", "Has Life Insurance": "Assurance vie", "Charge Type": "Rang de la charge",
  "Closing Date": "Date de clôture", Lender: "Prêteur", Product: "Produit", "Mortgage Amount": "Montant du prêt", "Contact Details": "Coordonnées",
  "Active Properties": "Propriétés actives", "Active CRM Campaigns": "Campagnes CRM actives",
};

// Unknown labels print in English rather than not at all.
export const frLabel = (s: string) => fr[s] ?? s.replace(/^Mortgage #(\d)$/, "Hypothèque no $1");
