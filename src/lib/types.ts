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
};
