import type { InstitutionAccount } from "@/lib/types";

export const ACCOUNT_GROUPS = [
  "Checking",
  "Savings",
  "Credit",
  "Loans",
  "Investments",
  "Other",
] as const;

export type AccountGroup = (typeof ACCOUNT_GROUPS)[number];

export function accountGroup(
  account: Pick<InstitutionAccount, "type" | "subtype">,
): AccountGroup {
  const kind = (account.type ?? "").toLowerCase();
  const subtype = (account.subtype ?? "").toLowerCase();
  if (subtype.includes("check")) return "Checking";
  if (subtype.includes("sav") || subtype.includes("money market") || subtype === "cd") {
    return "Savings";
  }
  if (kind === "credit" || subtype.includes("credit")) return "Credit";
  if (
    kind === "loan" ||
    subtype.includes("loan") ||
    subtype.includes("mortgage") ||
    subtype.includes("student")
  ) {
    return "Loans";
  }
  if (
    kind === "investment" ||
    kind === "brokerage" ||
    subtype.includes("brokerage") ||
    subtype.includes("ira") ||
    subtype.includes("401")
  ) {
    return "Investments";
  }
  return "Other";
}

export function isCashGroup(group: AccountGroup) {
  return group === "Checking" || group === "Savings";
}

export function isOwedGroup(group: AccountGroup) {
  return group === "Credit" || group === "Loans";
}
