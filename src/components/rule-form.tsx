"use client";

import type { InstitutionSummary, Category, RuleDirection } from "@/lib/types";
import { institutionLabel } from "@/lib/institution-label";

export type RuleDraft = {
  name: string;
  merchantContains: string;
  accountKey: string | null;
  direction: RuleDirection;
  amountMin: number | null;
  amountMax: number | null;
  categoryId: string;
  tags: string[];
};

export type RuleFormValues = {
  id: string | null;
  name: string;
  merchantContains: string;
  accountKey: string;
  direction: RuleDirection;
  amountMin: string;
  amountMax: string;
  categoryId: string;
  tags: string;
  enabled: boolean;
};

export const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--mint-line)] bg-white px-2.5 text-sm text-[var(--mint-ink)] outline-none focus-visible:border-[var(--mint-leaf)] focus-visible:ring-3 focus-visible:ring-[var(--mint-leaf)]/30";

export function emptyRuleForm(categoryId: string): RuleFormValues {
  return {
    id: null,
    name: "",
    merchantContains: "",
    accountKey: "",
    direction: "any",
    amountMin: "",
    amountMax: "",
    categoryId,
    tags: "",
    enabled: true,
  };
}

export function ruleFormFromDraft(draft: RuleDraft): RuleFormValues {
  return {
    id: null,
    name: draft.name,
    merchantContains: draft.merchantContains,
    accountKey: draft.accountKey ?? "",
    direction: draft.direction,
    amountMin: draft.amountMin == null ? "" : String(draft.amountMin),
    amountMax: draft.amountMax == null ? "" : String(draft.amountMax),
    categoryId: draft.categoryId,
    tags: draft.tags.join(", "),
    enabled: true,
  };
}

export function RuleForm({
  values,
  categories,
  institutions,
  saving,
  title,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: RuleFormValues;
  categories: Category[];
  institutions: InstitutionSummary[];
  saving: boolean;
  title: string;
  onChange: (values: RuleFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const accounts = institutions.flatMap((institution) =>
    institution.accounts.map((account) => ({
      key: `${institution.itemId}:${account.id}`,
      label: `${account.name} · ${institutionLabel(institution, institutions)}`,
    })),
  );

  function update(patch: Partial<RuleFormValues>) {
    onChange({ ...values, ...patch });
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-[var(--mint-line)] bg-[var(--mint-mist)]/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl">{title}</h3>
        <label className="flex items-center gap-2 text-sm text-[var(--mint-muted)]">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
          On
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            value={values.name}
            onChange={(event) => update({ name: event.target.value })}
            className={fieldClass}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Merchant contains
          <input
            value={values.merchantContains}
            onChange={(event) => update({ merchantContains: event.target.value })}
            className={fieldClass}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={values.categoryId}
            onChange={(event) => update({ categoryId: event.target.value })}
            className={fieldClass}
            required
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Account
          <select
            value={values.accountKey}
            onChange={(event) => update({ accountKey: event.target.value })}
            className={fieldClass}
          >
            <option value="">Any account</option>
            {accounts.map((account) => (
              <option key={account.key} value={account.key}>
                {account.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Direction
          <select
            value={values.direction}
            onChange={(event) => update({ direction: event.target.value as RuleDirection })}
            className={fieldClass}
          >
            <option value="any">Any</option>
            <option value="out">Money out</option>
            <option value="in">Money in</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tags
          <input
            value={values.tags}
            onChange={(event) => update({ tags: event.target.value })}
            placeholder="groceries, weekly"
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Minimum amount
          <input
            value={values.amountMin}
            onChange={(event) => update({ amountMin: event.target.value })}
            inputMode="decimal"
            placeholder="Optional"
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Maximum amount
          <input
            value={values.amountMax}
            onChange={(event) => update({ amountMax: event.target.value })}
            inputMode="decimal"
            placeholder="Optional"
            className={fieldClass}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="mint-cta h-10 rounded-lg px-4 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save rule"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg px-3 text-sm text-[var(--mint-muted)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
