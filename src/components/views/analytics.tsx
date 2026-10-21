"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  emptyRuleForm,
  RuleForm,
  ruleFormFromDraft,
  type RuleDraft,
  type RuleFormValues,
} from "@/components/rule-form";
import { filterByPeriod, summarizeAnalytics, type AnalyticsPeriod } from "@/lib/analytics";
import { directionLabel } from "@/lib/categorize";
import { formatPlainMoney } from "@/lib/money";
import type { Category, CategoryGroup, CategoryRule, InstitutionSummary, DisplayTransaction } from "@/lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";

type AnalyticsProps = {
  transactions: DisplayTransaction[];
  institutions: InstitutionSummary[];
  draft: { token: number; rule: RuleDraft } | null;
  onChanged: () => void;
};

const fieldClass =
  "h-10 rounded-lg border border-[var(--mint-line)] bg-white px-2.5 text-sm text-[var(--mint-ink)] outline-none focus-visible:border-[var(--mint-leaf)] focus-visible:ring-3 focus-visible:ring-[var(--mint-leaf)]/30";

async function readError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error || "Could not save that change.";
}

export function Analytics({
  transactions,
  institutions,
  draft,
  onChanged,
}: AnalyticsProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("month");
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [form, setForm] = useState<RuleFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [appliedDraft, setAppliedDraft] = useState(0);

  if (draft && draft.token !== appliedDraft) {
    setAppliedDraft(draft.token);
    setForm(ruleFormFromDraft(draft.rule));
    setError(null);
  }

  async function loadTaxonomy() {
    const [categoryResponse, ruleResponse] = await Promise.all([
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/rules", { cache: "no-store" }),
    ]);
    if (!categoryResponse.ok) throw new Error(await readError(categoryResponse));
    if (!ruleResponse.ok) throw new Error(await readError(ruleResponse));
    const categoryData = (await categoryResponse.json()) as { categories: Category[] };
    const ruleData = (await ruleResponse.json()) as { rules: CategoryRule[] };
    setCategories(categoryData.categories ?? []);
    setRules(ruleData.rules ?? []);
    setReady(true);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [categoryResponse, ruleResponse] = await Promise.all([
          fetch("/api/categories", { cache: "no-store" }),
          fetch("/api/rules", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (!categoryResponse.ok) throw new Error(await readError(categoryResponse));
        if (!ruleResponse.ok) throw new Error(await readError(ruleResponse));
        const categoryData = (await categoryResponse.json()) as { categories: Category[] };
        const ruleData = (await ruleResponse.json()) as { rules: CategoryRule[] };
        if (cancelled) return;
        setCategories(categoryData.categories ?? []);
        setRules(ruleData.rules ?? []);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load categories.");
        setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => filterByPeriod(transactions, period),
    [period, transactions],
  );
  const summary = useMemo(() => summarizeAnalytics(visible), [visible]);
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  async function reloadAfterChange() {
    await loadTaxonomy();
    onChanged();
  }

  async function saveRule() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        merchantContains: form.merchantContains,
        accountKey: form.accountKey || null,
        direction: form.direction,
        amountMin: form.amountMin.trim() === "" ? null : Number(form.amountMin),
        amountMax: form.amountMax.trim() === "" ? null : Number(form.amountMax),
        categoryId: form.categoryId,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        enabled: form.enabled,
      };
      const response = await fetch(form.id ? `/api/rules/${form.id}` : "/api/rules", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      setForm(null);
      await reloadAfterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the rule.");
    } finally {
      setSaving(false);
    }
  }

  async function moveRule(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= rules.length) return;
    const ordered = rules.slice();
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ordered.map((rule) => rule.id) }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await reloadAfterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reorder rules.");
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(rule: CategoryRule, enabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await reloadAfterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the rule.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(rule: CategoryRule) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      if (form?.id === rule.id) setForm(null);
      await reloadAfterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the rule.");
    } finally {
      setSaving(false);
    }
  }

  function editRule(rule: CategoryRule) {
    setForm({
      id: rule.id,
      name: rule.name,
      merchantContains: rule.merchantContains,
      accountKey: rule.accountKey ?? "",
      direction: rule.direction,
      amountMin: rule.amountMin == null ? "" : String(rule.amountMin),
      amountMax: rule.amountMax == null ? "" : String(rule.amountMax),
      categoryId: rule.categoryId,
      tags: rule.tags.join(", "),
      enabled: rule.enabled,
    });
    setError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm text-[var(--mint-muted)]">
          <span className="sr-only">Period</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as AnalyticsPeriod)}
            className={`${fieldClass} w-full sm:w-52`}
          >
            <option value="month">This month</option>
            <option value="quarter">Last 3 months</option>
            <option value="all">All loaded activity</option>
          </select>
        </label>
        <p className="text-sm text-[var(--mint-muted)]">
          {visible.length} {visible.length === 1 ? "transaction" : "transactions"}
          {transactions.length >= 500 ? " · showing the latest 500" : ""}
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200/80 bg-red-50/70 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {transactions.length === 0 ? (
        <section className="rounded-2xl border border-[var(--mint-line)] bg-white px-6 py-16 text-center shadow-sm">
          <p className="font-display text-2xl">Nothing to add up yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--mint-muted)]">
            Once activity is saved, this page totals money out by category and tag. Rules below
            still apply to new transactions.
          </p>
        </section>
      ) : (
        <>
          {summary.uncategorizedCount > 0 ? (
            <p className="rounded-2xl border border-[var(--mint-line)] bg-white px-5 py-4 text-sm shadow-sm">
              {formatPlainMoney(summary.uncategorized, summary.currency)} across{" "}
              {summary.uncategorizedCount}{" "}
              {summary.uncategorizedCount === 1 ? "transaction is" : "transactions are"} still
              uncategorized.
            </p>
          ) : null}
          <Breakdown
            title="Spending by category"
            empty="No money out in this period."
            rows={summary.spending}
            currency={summary.currency}
          />
          <Breakdown
            title="Spending by tag"
            empty="No tags on money out in this period."
            rows={summary.tags}
            currency={summary.currency}
          />
          <Breakdown
            title="Income by category"
            empty="No money in for this period."
            rows={summary.income}
            currency={summary.currency}
          />
        </>
      )}

      <section className="rounded-2xl border border-[var(--mint-line)] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-4">
          <div>
            <h2 className="font-display text-xl">Rules</h2>
            <p className="mt-1 text-xs text-[var(--mint-muted)]">
              The first matching rule sets the category and tags. A manual edit on a transaction
              stays put.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 border-[var(--mint-line)] bg-white"
            onClick={() => {
              setForm(emptyRuleForm(categories[0]?.id ?? ""));
              setError(null);
            }}
            disabled={!ready}
          >
            Add rule
          </Button>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          {form ? (
            <RuleForm
              values={form}
              categories={categories}
              institutions={institutions}
              saving={saving}
              title={form.id ? "Edit rule" : "New rule"}
              onChange={setForm}
              onSubmit={() => void saveRule()}
              onCancel={() => setForm(null)}
            />
          ) : null}
          {rules.length === 0 ? (
            <p className="text-sm text-[var(--mint-muted)]">
              No rules yet. Match a merchant name, then assign a category and tags.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rules.map((rule, index) => (
                <li
                  key={rule.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--mint-line)] px-3 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {rule.name}
                      {rule.enabled ? "" : " · Off"}
                    </p>
                    <p className="truncate text-sm text-[var(--mint-muted)]">
                      {rule.merchantContains} · {directionLabel(rule.direction)} ·{" "}
                      {categoryName.get(rule.categoryId) ?? "Unknown"}
                      {rule.tags.length ? ` · ${rule.tags.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move rule up"
                      disabled={saving || index === 0}
                      onClick={() => void moveRule(index, -1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move rule down"
                      disabled={saving || index === rules.length - 1}
                      onClick={() => void moveRule(index, 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8"
                      disabled={saving}
                      onClick={() => void setEnabled(rule, !rule.enabled)}
                    >
                      {rule.enabled ? "Turn off" : "Turn on"}
                    </Button>
                    <Button type="button" variant="ghost" className="h-8" onClick={() => editRule(rule)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8"
                      disabled={saving}
                      onClick={() => void removeRule(rule)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <CategoryEditor
        categories={categories}
        disabled={!ready || saving}
        onError={setError}
        onSaved={() => void reloadAfterChange()}
      />
    </div>
  );
}

function Breakdown({
  title,
  empty,
  rows,
  currency,
}: {
  title: string;
  empty: string;
  rows: { key: string; label: string; total: number }[];
  currency: string;
}) {
  const peak = Math.max(1, ...rows.map((row) => row.total));
  return (
    <section className="rounded-2xl border border-[var(--mint-line)] bg-white shadow-sm">
      <div className="border-b border-[var(--mint-line)] px-5 py-4">
        <h2 className="font-display text-xl">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--mint-muted)]">{empty}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.key}
              className="grid gap-2 border-b border-[var(--mint-line)] px-5 py-3 last:border-b-0 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7rem] sm:items-center"
            >
              <p className="truncate text-sm font-medium">{row.label}</p>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--mint-mist)]">
                <div
                  className="h-2 rounded-full bg-[var(--mint-ink)]"
                  style={{ width: `${Math.max((row.total / peak) * 100, 2)}%` }}
                />
              </div>
              <p className="text-right text-sm tabular-nums">
                {formatPlainMoney(row.total, currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryEditor({
  categories,
  disabled,
  onError,
  onSaved,
}: {
  categories: Category[];
  disabled: boolean;
  onError: (message: string | null) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<CategoryGroup>("spending");
  const [drafts, setDrafts] = useState<Record<string, { name: string; group: CategoryGroup }>>({});

  function draftFor(category: Category) {
    return drafts[category.id] ?? { name: category.name, group: category.group };
  }

  async function addCategory() {
    onError(null);
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, group }),
    });
    if (!response.ok) {
      onError(await readError(response));
      return;
    }
    setName("");
    setGroup("spending");
    onSaved();
  }

  async function saveCategory(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    onError(null);
    const response = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) {
      onError(await readError(response));
      return;
    }
    onSaved();
  }

  async function removeCategory(id: string) {
    onError(null);
    const response = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      onError(await readError(response));
      return;
    }
    onSaved();
  }

  return (
    <section className="rounded-2xl border border-[var(--mint-line)] bg-white shadow-sm">
      <div className="border-b border-[var(--mint-line)] px-5 py-4">
        <h2 className="font-display text-xl">Categories</h2>
        <p className="mt-1 text-xs text-[var(--mint-muted)]">
          Transfers are left out of spending and income totals.
        </p>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void addCategory();
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New category"
            className={fieldClass}
            required
          />
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value as CategoryGroup)}
            className={fieldClass}
          >
            <option value="spending">Spending</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
          <Button type="submit" className="h-10" disabled={disabled}>
            Add
          </Button>
        </form>
        <ul className="flex flex-col gap-2">
          {categories.map((category) => {
            const draft = draftFor(category);
            const dirty = draft.name !== category.name || draft.group !== category.group;
            return (
              <li key={category.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto_auto]">
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [category.id]: { ...draft, name: event.target.value },
                    }))
                  }
                  className={fieldClass}
                />
                <select
                  value={draft.group}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [category.id]: { ...draft, group: event.target.value as CategoryGroup },
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="spending">Spending</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 border-[var(--mint-line)]"
                  disabled={disabled || !dirty}
                  onClick={() => void saveCategory(category.id)}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10"
                  disabled={disabled}
                  onClick={() => void removeCategory(category.id)}
                >
                  Delete
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
