export type AccountPayment = {
  dueDate: string | null;
  minimumAmount: number | null;
  statementBalance: number | null;
  statementDate: string | null;
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
  overdue: boolean | null;
  purchaseApr: number | null;
};

export type InstitutionAccount = {
  id: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  limit: number | null;
  currency: string | null;
  payment: AccountPayment | null;
};

export type LiabilitiesStatus = "ready" | "unavailable";

export type InstitutionSummary = {
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  lastSyncedAt: string | null;
  balancesAsOf: string | null;
  liabilitiesStatus: LiabilitiesStatus | null;
  accounts: InstitutionAccount[];
};

export type CategoryGroup = "spending" | "income" | "transfer";

export type Category = {
  id: string;
  name: string;
  group: CategoryGroup;
  plaidPrimaries: string[];
};

export type RuleDirection = "any" | "in" | "out";

export type CategoryRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  merchantContains: string;
  accountKey: string | null;
  direction: RuleDirection;
  amountMin: number | null;
  amountMax: number | null;
  categoryId: string;
  tags: string[];
};

export type CategorySource = "manual" | "rule" | "plaid" | "none";

export type DisplayTransaction = {
  id: string;
  date: string;
  name: string;
  merchant: string | null;
  amount: number;
  currency: string;
  accountId: string;
  accountName: string;
  pending: boolean;
  itemId: string;
  institutionName: string | null;
  plaidCategoryPrimary: string | null;
  plaidCategoryDetailed: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryGroup: CategoryGroup | null;
  tags: string[];
  categorySource: CategorySource;
  ruleId: string | null;
};
