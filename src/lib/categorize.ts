import type {
  Category,
  CategoryGroup,
  CategoryRule,
  CategorySource,
  RuleDirection,
} from "@/lib/types";

export type MatchableTransaction = {
  itemId: string;
  accountId: string;
  name: string;
  merchant: string | null;
  amount: number;
};

export type StoredLabel = {
  itemId: string;
  transactionId: string;
  categoryId: string;
  tags: string[];
  source: "manual" | "rule";
  ruleId: string | null;
};

export type ResolvedCategory = {
  categoryId: string | null;
  categoryName: string | null;
  categoryGroup: CategoryGroup | null;
  tags: string[];
  categorySource: CategorySource;
  ruleId: string | null;
};

type SeedCategory = {
  id: string;
  name: string;
  group: CategoryGroup;
  plaidPrimaries: string[];
};

export const SEED_CATEGORIES: SeedCategory[] = [
  { id: "cat_income", name: "Income", group: "income", plaidPrimaries: ["INCOME"] },
  {
    id: "cat_transfers",
    name: "Transfers",
    group: "transfer",
    plaidPrimaries: ["TRANSFER_IN", "TRANSFER_OUT"],
  },
  {
    id: "cat_loan_payments",
    name: "Loan payments",
    group: "spending",
    plaidPrimaries: ["LOAN_PAYMENTS"],
  },
  { id: "cat_fees", name: "Fees", group: "spending", plaidPrimaries: ["BANK_FEES"] },
  {
    id: "cat_entertainment",
    name: "Entertainment",
    group: "spending",
    plaidPrimaries: ["ENTERTAINMENT"],
  },
  {
    id: "cat_food",
    name: "Food and drink",
    group: "spending",
    plaidPrimaries: ["FOOD_AND_DRINK"],
  },
  {
    id: "cat_shopping",
    name: "Shopping",
    group: "spending",
    plaidPrimaries: ["GENERAL_MERCHANDISE"],
  },
  { id: "cat_home", name: "Home", group: "spending", plaidPrimaries: ["HOME_IMPROVEMENT"] },
  { id: "cat_medical", name: "Medical", group: "spending", plaidPrimaries: ["MEDICAL"] },
  {
    id: "cat_personal_care",
    name: "Personal care",
    group: "spending",
    plaidPrimaries: ["PERSONAL_CARE"],
  },
  {
    id: "cat_services",
    name: "Services",
    group: "spending",
    plaidPrimaries: ["GENERAL_SERVICES"],
  },
  {
    id: "cat_taxes",
    name: "Taxes and donations",
    group: "spending",
    plaidPrimaries: ["GOVERNMENT_AND_NON_PROFIT"],
  },
  {
    id: "cat_transportation",
    name: "Transportation",
    group: "spending",
    plaidPrimaries: ["TRANSPORTATION"],
  },
  { id: "cat_travel", name: "Travel", group: "spending", plaidPrimaries: ["TRAVEL"] },
  {
    id: "cat_bills",
    name: "Bills",
    group: "spending",
    plaidPrimaries: ["RENT_AND_UTILITIES"],
  },
];

const GROUPS = new Set<CategoryGroup>(["spending", "income", "transfer"]);
const DIRECTIONS = new Set<RuleDirection>(["any", "in", "out"]);

export class TaxonomyError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TaxonomyError";
    this.status = status;
  }
}

export function normalizeTags(tags: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    if (trimmed.length > 32) {
      throw new TaxonomyError("Tags must be 32 characters or fewer.");
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  if (result.length > 12) {
    throw new TaxonomyError("Use 12 tags or fewer.");
  }
  return result;
}

export function parseTags(value: unknown) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return normalizeTags(value.map((tag) => String(tag)));
  }
  if (typeof value === "string") {
    return normalizeTags(value.split(","));
  }
  throw new TaxonomyError("Tags must be a list.");
}

export function ruleMatches(rule: CategoryRule, tx: MatchableTransaction) {
  if (!rule.enabled) return false;
  const needle = rule.merchantContains.trim().toLowerCase();
  if (!needle) return false;
  const haystack = `${tx.merchant ?? ""} ${tx.name}`.toLowerCase();
  if (!haystack.includes(needle)) return false;
  if (rule.accountKey && `${tx.itemId}:${tx.accountId}` !== rule.accountKey) return false;
  if (rule.direction === "out" && !(tx.amount > 0)) return false;
  if (rule.direction === "in" && !(tx.amount < 0)) return false;
  const absolute = Math.abs(tx.amount);
  if (rule.amountMin != null && absolute < rule.amountMin) return false;
  if (rule.amountMax != null && absolute > rule.amountMax) return false;
  return true;
}

export function firstMatchingRule(
  rules: CategoryRule[],
  tx: MatchableTransaction,
  categoryIds?: Set<string>,
) {
  const ordered = [...rules].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  );
  return (
    ordered.find((rule) => {
      if (categoryIds && !categoryIds.has(rule.categoryId)) return false;
      return ruleMatches(rule, tx);
    }) ?? null
  );
}

export function categoryForPlaid(categories: Category[], primary: string | null) {
  if (!primary) return null;
  return categories.find((category) => category.plaidPrimaries.includes(primary)) ?? null;
}

export function resolveCategory(
  plaidCategoryPrimary: string | null,
  label: StoredLabel | null,
  categories: Category[],
): ResolvedCategory {
  if (label) {
    const category = categories.find((item) => item.id === label.categoryId);
    return {
      categoryId: label.categoryId,
      categoryName: category?.name ?? "Unknown",
      categoryGroup: category?.group ?? null,
      tags: label.tags,
      categorySource: label.source,
      ruleId: label.ruleId,
    };
  }

  const mapped = categoryForPlaid(categories, plaidCategoryPrimary);
  if (mapped) {
    return {
      categoryId: mapped.id,
      categoryName: mapped.name,
      categoryGroup: mapped.group,
      tags: [],
      categorySource: "plaid",
      ruleId: null,
    };
  }

  return {
    categoryId: null,
    categoryName: null,
    categoryGroup: null,
    tags: [],
    categorySource: "none",
    ruleId: null,
  };
}

function cleanName(value: unknown, label: string) {
  if (typeof value !== "string") throw new TaxonomyError(`${label} is required.`);
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) throw new TaxonomyError(`${label} is required.`);
  if (name.length > 60) throw new TaxonomyError(`${label} must be 60 characters or fewer.`);
  return name;
}

export function parseCategoryGroup(value: unknown): CategoryGroup {
  if (typeof value === "string" && GROUPS.has(value as CategoryGroup)) {
    return value as CategoryGroup;
  }
  throw new TaxonomyError("Choose spending, income, or transfer.");
}

function parseOptionalAmount(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TaxonomyError(`${label} must be zero or greater.`);
  }
  return amount;
}

export function parseCategoryWrite(body: unknown, partial: boolean) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const next: { name?: string; group?: CategoryGroup } = {};
  if (!partial || "name" in record) next.name = cleanName(record.name, "Name");
  if (!partial || "group" in record) next.group = parseCategoryGroup(record.group);
  if (partial && next.name == null && next.group == null) {
    throw new TaxonomyError("Nothing to update.");
  }
  return next;
}

export function directionLabel(direction: RuleDirection) {
  if (direction === "in") return "Money in";
  if (direction === "out") return "Money out";
  return "Any direction";
}

export function parseRuleWrite(body: unknown, partial: boolean) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const next: {
    name?: string;
    enabled?: boolean;
    priority?: number;
    merchantContains?: string;
    accountKey?: string | null;
    direction?: RuleDirection;
    amountMin?: number | null;
    amountMax?: number | null;
    categoryId?: string;
    tags?: string[];
  } = {};

  if (!partial || "name" in record) next.name = cleanName(record.name, "Name");
  if (!partial || "merchantContains" in record) {
    next.merchantContains = cleanName(record.merchantContains, "Merchant text");
  }
  if (!partial || "categoryId" in record) {
    if (typeof record.categoryId !== "string" || !record.categoryId.trim()) {
      throw new TaxonomyError("Choose a category.");
    }
    next.categoryId = record.categoryId.trim();
  }
  if (!partial || "enabled" in record) {
    if (typeof record.enabled !== "boolean") {
      throw new TaxonomyError("Enabled must be true or false.");
    }
    next.enabled = record.enabled;
  }
  if (!partial || "direction" in record) {
    if (typeof record.direction !== "string" || !DIRECTIONS.has(record.direction as RuleDirection)) {
      throw new TaxonomyError("Choose any, money in, or money out.");
    }
    next.direction = record.direction as RuleDirection;
  }
  if (!partial || "accountKey" in record) {
    if (record.accountKey == null || record.accountKey === "") next.accountKey = null;
    else if (typeof record.accountKey === "string" && record.accountKey.includes(":")) {
      next.accountKey = record.accountKey;
    } else {
      throw new TaxonomyError("Choose an account or leave it blank.");
    }
  }
  if (!partial || "amountMin" in record) {
    next.amountMin = parseOptionalAmount(record.amountMin, "Minimum amount");
  }
  if (!partial || "amountMax" in record) {
    next.amountMax = parseOptionalAmount(record.amountMax, "Maximum amount");
  }
  if (!partial || "tags" in record) next.tags = parseTags(record.tags);
  if ("priority" in record) {
    const priority = Number(record.priority);
    if (!Number.isFinite(priority)) throw new TaxonomyError("Priority must be a number.");
    next.priority = priority;
  }

  const amountMin = next.amountMin;
  const amountMax = next.amountMax;
  if (amountMin != null && amountMax != null && amountMin > amountMax) {
    throw new TaxonomyError("Minimum amount cannot be greater than maximum amount.");
  }

  if (partial && Object.keys(next).length === 0) {
    throw new TaxonomyError("Nothing to update.");
  }
  return next;
}
