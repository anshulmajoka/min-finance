export type InstitutionSummary = {
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  lastSyncedAt: string | null;
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
