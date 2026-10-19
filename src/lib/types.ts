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
};
