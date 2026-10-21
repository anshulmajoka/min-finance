import type { AnyBulkWriteOperation } from "mongodb";
import {
  SEED_CATEGORIES,
  TaxonomyError,
  firstMatchingRule,
  parseCategoryWrite,
  parseRuleWrite,
  parseTags,
} from "@/lib/categorize";
import type { StoredLabel } from "@/lib/categorize";
import { getDb } from "@/lib/mongo";
import type { Category, CategoryRule } from "@/lib/types";

type CategoryDocument = Category & { createdAt: Date; updatedAt: Date };
type RuleDocument = CategoryRule & { createdAt: Date; updatedAt: Date };
type LabelDocument = StoredLabel & { updatedAt: Date };

type TransactionMatch = {
  itemId: string;
  transactionId: string;
  accountId: string;
  name: string;
  merchant: string | null;
  amount: number;
};

function toCategory(doc: CategoryDocument): Category {
  return {
    id: doc.id,
    name: doc.name,
    group: doc.group,
    plaidPrimaries: doc.plaidPrimaries ?? [],
  };
}

function toRule(doc: RuleDocument): CategoryRule {
  return {
    id: doc.id,
    name: doc.name,
    enabled: doc.enabled,
    priority: doc.priority,
    merchantContains: doc.merchantContains,
    accountKey: doc.accountKey,
    direction: doc.direction,
    amountMin: doc.amountMin,
    amountMax: doc.amountMax,
    categoryId: doc.categoryId,
    tags: doc.tags ?? [],
  };
}

function isDuplicateKey(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code?: number }).code === 11000) return true;
  const writeErrors = (error as { writeErrors?: { code?: number }[] }).writeErrors;
  return Array.isArray(writeErrors) && writeErrors.some((item) => item.code === 11000);
}

export async function listCategories() {
  const db = await getDb();
  const collection = db.collection<CategoryDocument>("categories");
  const existing = await collection.countDocuments();
  if (existing === 0) {
    const now = new Date();
    try {
      await collection.insertMany(
        SEED_CATEGORIES.map((category) => ({ ...category, createdAt: now, updatedAt: now })),
        { ordered: false },
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }

  const docs = await collection.find({}).sort({ name: 1 }).toArray();
  return docs.map(toCategory);
}

export async function createCategory(body: unknown) {
  const parsed = parseCategoryWrite(body, false);
  const now = new Date();
  const category: CategoryDocument = {
    id: `cat_${crypto.randomUUID()}`,
    name: parsed.name ?? "Category",
    group: parsed.group ?? "spending",
    plaidPrimaries: [],
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDb();
  await db.collection<CategoryDocument>("categories").insertOne(category);
  return toCategory(category);
}

export async function updateCategory(id: string, body: unknown) {
  const parsed = parseCategoryWrite(body, true);
  const db = await getDb();
  const collection = db.collection<CategoryDocument>("categories");
  const existing = await collection.findOne({ id });
  if (!existing) throw new TaxonomyError("Category not found.", 404);
  await collection.updateOne(
    { id },
    { $set: { ...parsed, updatedAt: new Date() } },
  );
  const next = await collection.findOne({ id });
  if (!next) throw new TaxonomyError("Category not found.", 404);
  return toCategory(next);
}

export async function deleteCategory(id: string) {
  const db = await getDb();
  const usedByRule = await db.collection<RuleDocument>("rules").findOne({ categoryId: id });
  if (usedByRule) {
    throw new TaxonomyError("A rule still uses this category.", 409);
  }
  const usedByLabel = await db
    .collection<LabelDocument>("transaction_labels")
    .findOne({ categoryId: id });
  if (usedByLabel) {
    throw new TaxonomyError("A transaction still uses this category.", 409);
  }
  const result = await db.collection<CategoryDocument>("categories").deleteOne({ id });
  if (result.deletedCount === 0) throw new TaxonomyError("Category not found.", 404);
}

export async function listRules() {
  const db = await getDb();
  const docs = await db
    .collection<RuleDocument>("rules")
    .find({})
    .sort({ priority: 1, id: 1 })
    .toArray();
  return docs.map(toRule);
}

async function requireCategory(categoryId: string) {
  const categories = await listCategories();
  if (!categories.some((category) => category.id === categoryId)) {
    throw new TaxonomyError("Choose a category.");
  }
}

export async function createRule(body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const parsed = parseRuleWrite(
    {
      enabled: true,
      direction: "any",
      accountKey: null,
      amountMin: null,
      amountMax: null,
      tags: [],
      ...record,
    },
    false,
  );
  if (!parsed.categoryId || !parsed.merchantContains || !parsed.name) {
    throw new TaxonomyError("Name, merchant text, and category are required.");
  }
  await requireCategory(parsed.categoryId);
  const db = await getDb();
  const rules = db.collection<RuleDocument>("rules");
  const first = await rules.find({}, { projection: { priority: 1 } }).sort({ priority: 1 }).limit(1).toArray();
  const now = new Date();
  const rule: RuleDocument = {
    id: `rule_${crypto.randomUUID()}`,
    name: parsed.name,
    enabled: parsed.enabled ?? true,
    priority: (first[0]?.priority ?? 0) - 1,
    merchantContains: parsed.merchantContains,
    accountKey: parsed.accountKey ?? null,
    direction: parsed.direction ?? "any",
    amountMin: parsed.amountMin ?? null,
    amountMax: parsed.amountMax ?? null,
    categoryId: parsed.categoryId,
    tags: parsed.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  if (
    rule.amountMin != null &&
    rule.amountMax != null &&
    rule.amountMin > rule.amountMax
  ) {
    throw new TaxonomyError("Minimum amount cannot be greater than maximum amount.");
  }
  await rules.insertOne(rule);
  await applyCategoryRules();
  return toRule(rule);
}

export async function updateRule(id: string, body: unknown) {
  const parsed = parseRuleWrite(body, true);
  const db = await getDb();
  const rules = db.collection<RuleDocument>("rules");
  const existing = await rules.findOne({ id });
  if (!existing) throw new TaxonomyError("Rule not found.", 404);
  if (parsed.categoryId) await requireCategory(parsed.categoryId);
  const amountMin = parsed.amountMin === undefined ? existing.amountMin : parsed.amountMin;
  const amountMax = parsed.amountMax === undefined ? existing.amountMax : parsed.amountMax;
  if (amountMin != null && amountMax != null && amountMin > amountMax) {
    throw new TaxonomyError("Minimum amount cannot be greater than maximum amount.");
  }
  await rules.updateOne({ id }, { $set: { ...parsed, updatedAt: new Date() } });
  await applyCategoryRules();
  const next = await rules.findOne({ id });
  if (!next) throw new TaxonomyError("Rule not found.", 404);
  return toRule(next);
}

export async function deleteRule(id: string) {
  const db = await getDb();
  const result = await db.collection<RuleDocument>("rules").deleteOne({ id });
  if (result.deletedCount === 0) throw new TaxonomyError("Rule not found.", 404);
  await applyCategoryRules();
}

export async function reorderRules(ids: string[]) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    throw new TaxonomyError("The rule list is out of date.");
  }
  const rules = await listRules();
  const known = new Set(rules.map((rule) => rule.id));
  if (ids.length !== rules.length || ids.some((id) => !known.has(id))) {
    throw new TaxonomyError("The rule list is out of date. Refresh and try again.");
  }
  const db = await getDb();
  const now = new Date();
  await db.collection<RuleDocument>("rules").bulkWrite(
    ids.map((id, priority) => ({
      updateOne: {
        filter: { id },
        update: { $set: { priority, updatedAt: now } },
      },
    })),
  );
  await applyCategoryRules();
}

export async function listLabels(itemId?: string) {
  const db = await getDb();
  const filter = itemId ? { itemId } : {};
  const docs = await db.collection<LabelDocument>("transaction_labels").find(filter).toArray();
  return docs.map((doc) => ({
    itemId: doc.itemId,
    transactionId: doc.transactionId,
    categoryId: doc.categoryId,
    tags: doc.tags ?? [],
    source: doc.source,
    ruleId: doc.ruleId ?? null,
  }));
}

export async function deleteLabelsForTransactions(itemId: string, transactionIds: string[]) {
  if (transactionIds.length === 0) return;
  const db = await getDb();
  await db.collection<LabelDocument>("transaction_labels").deleteMany({
    itemId,
    transactionId: { $in: transactionIds },
  });
}

export async function deleteLabelsForItem(itemId: string) {
  const db = await getDb();
  await db.collection<LabelDocument>("transaction_labels").deleteMany({ itemId });
}

export async function deleteAllLabels() {
  const db = await getDb();
  await db.collection<LabelDocument>("transaction_labels").deleteMany({});
}

export async function setManualLabel(input: {
  itemId: string;
  transactionId: string;
  categoryId: string | null;
  tags?: unknown;
}) {
  const itemId = input.itemId.trim();
  const transactionId = input.transactionId.trim();
  if (!itemId || !transactionId) throw new TaxonomyError("Transaction not found.", 404);

  const db = await getDb();
  const tx = await db.collection<TransactionMatch>("transactions").findOne({
    itemId,
    transactionId,
  });
  if (!tx) throw new TaxonomyError("Transaction not found.", 404);

  const labels = db.collection<LabelDocument>("transaction_labels");
  if (input.categoryId == null) {
    await labels.deleteOne({ itemId, transactionId });
    await applyCategoryRules({ itemId, transactionIds: [transactionId] });
    return;
  }

  const categoryId = input.categoryId.trim();
  await requireCategory(categoryId);
  const tags = parseTags(input.tags ?? []);
  await labels.updateOne(
    { itemId, transactionId },
    {
      $set: {
        itemId,
        transactionId,
        categoryId,
        tags,
        source: "manual" as const,
        ruleId: null,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function applyCategoryRules(scope?: {
  itemId?: string;
  transactionIds?: string[];
}) {
  const categories = await listCategories();
  const rules = await listRules();
  const categoryIds = new Set(categories.map((category) => category.id));
  const db = await getDb();
  const filter: { itemId?: string; transactionId?: { $in: string[] } } = {};
  if (scope?.itemId) filter.itemId = scope.itemId;
  if (scope?.transactionIds) {
    if (scope.transactionIds.length === 0) return;
    filter.transactionId = { $in: scope.transactionIds };
  }

  const transactions = await db
    .collection<TransactionMatch>("transactions")
    .find(filter)
    .toArray();
  if (transactions.length === 0) return;

  const labelFilter: { itemId?: string; transactionId?: { $in: string[] } } = {};
  if (scope?.itemId) labelFilter.itemId = scope.itemId;
  if (scope?.transactionIds) labelFilter.transactionId = { $in: scope.transactionIds };
  const labels = await db.collection<LabelDocument>("transaction_labels").find(labelFilter).toArray();
  const labelByKey = new Map(
    labels.map((label) => [`${label.itemId}:${label.transactionId}`, label]),
  );

  const writes: AnyBulkWriteOperation<LabelDocument>[] = [];
  const removals: { itemId: string; transactionId: string }[] = [];
  const now = new Date();

  for (const tx of transactions) {
    const key = `${tx.itemId}:${tx.transactionId}`;
    const existing = labelByKey.get(key);
    if (existing?.source === "manual") continue;

    const rule = firstMatchingRule(rules, tx, categoryIds);
    if (!rule) {
      if (existing) removals.push({ itemId: tx.itemId, transactionId: tx.transactionId });
      continue;
    }

    const same =
      existing?.source === "rule" &&
      existing.ruleId === rule.id &&
      existing.categoryId === rule.categoryId &&
      existing.tags.join("\n").toLowerCase() === rule.tags.join("\n").toLowerCase();
    if (same) continue;

    writes.push({
      updateOne: {
        filter: { itemId: tx.itemId, transactionId: tx.transactionId },
        update: {
          $set: {
            itemId: tx.itemId,
            transactionId: tx.transactionId,
            categoryId: rule.categoryId,
            tags: rule.tags,
            source: "rule" as const,
            ruleId: rule.id,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    });
  }

  const collection = db.collection<LabelDocument>("transaction_labels");
  if (writes.length > 0) {
    await collection.bulkWrite(writes, { ordered: false });
  }
  if (removals.length > 0) {
    await collection.deleteMany({
      $or: removals.map((label) => ({
        itemId: label.itemId,
        transactionId: label.transactionId,
        source: "rule" as const,
      })),
    });
  }
}
