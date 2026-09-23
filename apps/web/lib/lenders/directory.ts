/**
 * PRD-16 W1 frontend lender directory.
 * Seeded from Appendix A until GET /api/lenders ships (W0). Search is local only —
 * product create still posts lenderName so the existing API contract is unchanged.
 */

export const OTHER_LENDER_NAME = 'Other';

export const LENDER_DIRECTORY_SEED: readonly string[] = [
  'Accord Mortgages',
  'Affirmative',
  'Afin Bank',
  'Ahil United',
  'AIB',
  'Aldermore Bank',
  'Alicja Bank',
  'Al Rayan',
  'Alternative Bridging',
  'April Mortgages',
  'Aria Finance',
  'Aspen Bridging',
  'Aviva',
  'Bank Of China (UK)',
  'Bank of Ireland',
  'Bath Building Society',
  'BC Invest',
  'Bespoke BOI',
  'Beverley Building Society',
  'Birmingham Bank',
  'Black & White Bridging',
  'Bluestone Mortgages',
  'BM Solutions',
  'Bradford & Bingley',
  'Buckinghamshire Building Society',
  'Cabot Financial',
  'CAF Bank',
  'Cambridge Building Society',
  'Canada Life',
  'Castle Trust',
  'Central Trust 1st',
  'Charter Bank',
  'Chaseblue Loans LTD',
  'Chelsea Building Society',
  'CHL Mortgages',
  'Chorley & District Building Society',
  'Clydesdale Bank PLC',
  'Co-operative Bank',
  'Coutts',
  'Coventry BS',
  'Cumberland BS',
  'Cynergy Bank',
  'Danske Bank',
  'Darlington Building Society',
  'Digital Mortgages / Atom bank',
  'Dudley Building Society',
  'Earl Shilton Building Society',
  'Ecology Building Society',
  'Equifinance',
  'Even',
  'Family BS',
  'First Direct',
  'Fleet Mortgages',
  'Foundation Home Loans',
  'Furness Building Society',
  'Gable Mortgages',
  'Gatehouse Bank',
  'Generation Home',
  'Glenhawk',
  'Godiva BTL',
  'Greenfield Mortgages',
  'Habito',
  'Halifax',
  'Hampden & Co',
  'Hampshire Trust Bank',
  'Handelsbanken',
  'Hanley Economic Building Society',
  'Harpenden Building Society',
  'Heliodor',
  'Hodge',
  'Hope Capital',
  'HSBC',
  'Hyalite Mortgages',
  'Intelligent Finance',
  'InterBay',
  'Investec',
  'Jasper Mortgages',
  'Kensington',
  'Kent Reliance Bank',
  'Keystone Property Finance',
  'KSEYE',
  'Kufink',
  'L&G HL',
  'Landbay',
  'Landmark Mortgages',
  'Leeds Building Society',
  'Leek United Building Society',
  'Lendco',
  'LendInvest',
  'LiveMore',
  'Lloyds Bank',
  'Loughborough Building Society',
  'LV — Liverpool Victoria',
  'Mansfield Building Society',
  'Market Harborough Building Society',
  'Marsden Building Society',
  'Masthaven',
  'MBS Lending Ltd',
  'Melanite Mortgages',
  'Melton BS',
  'Metro Bank',
  'MFS',
  'Mint Property Finance',
  'Moda Mortgages',
  'Molo',
  'Monmouthshire Building Society',
  'Morag Finance',
  'More 2 Life',
  'Mortgage Express',
  'MPowered Mortgages',
  'MT Finance',
  'Nationwide Building Society',
  'NatWest',
  'Natwest International',
  'Newbury Building Society',
  'Newcastle Building Society',
  'Nomo Bank',
  'Norton Home Loans',
  'Nottingham Building Society',
  'NRAM',
  'OakNorth Bank',
  'Octane Capital',
  'Octopus Real Estate',
  'Ortus',
  'Oxbury Bank',
  'Paragon',
  'Penrith Building Society',
  'Pepper Money',
  'Perenna',
  'Platform',
  'Post Office',
  'Precise Mortgages',
  'Principality Building Society',
  'Progressive Building Society',
  'Pure Retirement',
  'Quantum Mortgages',
  'Raw Capital',
  'Reliance Bank',
  'Rely',
  'Responsible Life',
  'Roma Finance',
  'Rosinca',
  'Rosolite Mortgages',
  'Royal Bank of Scotland',
  'Saffron BS',
  'Santander',
  'Saxon Trust',
  'Scottish Building Society',
  'Scottish Widows Bank',
  'Secure Trust Bank',
  'Selina Finance',
  'Shawbrook Bank Limited',
  'Skipton Building Society',
  'Skipton International',
  'SoMo',
  'Stafford Railway Building Society',
  'State Bank of India',
  'Step One Finance',
  'Streambank',
  'StrideUp',
  'Suffolk Building Society',
  'Swansea Building Society',
  'Tandem Bank',
  'TBMC',
  'Teachers Building Society',
  'Tenn Capital',
  'TFC Homeloans / All Money Matters',
  'TFG Capital',
  'The Mortgage Lender',
  'The Mortgage Works',
  'Tipton Building Society',
  'Together',
  'Topaz Finance',
  'TSB Bank',
  'Tulip Mortgages',
  'Tuscan Capital',
  'Ultimate Finance',
  'United Trust Bank',
  'Vernon',
  'Vida Homeloans',
  'Virgin Money',
  'Wave Lending',
  'Weatherbys',
  'West Brom',
  'West One',
  'Yorkshire Bank',
  'Yorkshire Building Society',
  'Zephyr Homeloans',
];

export function normalizeLenderName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export type LenderSearchHit = {
  id?: string;
  name: string;
  isOther: boolean;
};

const DIRECTORY_WITHOUT_OTHER = LENDER_DIRECTORY_SEED.filter(
  (name) => normalizeLenderName(name) !== normalizeLenderName(OTHER_LENDER_NAME),
);

/** Typeahead: match by substring on the normalised name. Other is always last. */
export function searchLenders(query: string, limit = 20): LenderSearchHit[] {
  const q = normalizeLenderName(query);
  const matches = q
    ? DIRECTORY_WITHOUT_OTHER.filter((name) => normalizeLenderName(name).includes(q))
    : [...DIRECTORY_WITHOUT_OTHER];
  const capped = matches.slice(0, Math.max(1, limit));
  return [...capped.map((name) => ({ name, isOther: false })), { name: OTHER_LENDER_NAME, isOther: true }];
}

export function findLenderName(query: string): string | null {
  const q = normalizeLenderName(query);
  if (!q) return null;
  if (q === normalizeLenderName(OTHER_LENDER_NAME)) return OTHER_LENDER_NAME;
  return DIRECTORY_WITHOUT_OTHER.find((name) => normalizeLenderName(name) === q) ?? null;
}

/** Map a stored lender string onto the select: directory hit, or Other + free text. */
export function resolveLenderSelection(value: string): { selectedName: string; otherName: string } {
  const trimmed = value.trim();
  if (!trimmed) return { selectedName: '', otherName: '' };
  const match = findLenderName(trimmed);
  if (match && match !== OTHER_LENDER_NAME) return { selectedName: match, otherName: '' };
  return { selectedName: OTHER_LENDER_NAME, otherName: trimmed };
}
