import { monthlyCashFlow, summarizeFlow } from "@/lib/cash-flow";
import { formatPlainMoney } from "@/lib/money";
import type { DisplayTransaction } from "@/lib/types";

export function CashFlow({ transactions }: { transactions: DisplayTransaction[] }) {
  const months = monthlyCashFlow(transactions);
  const totals = summarizeFlow(transactions);
  const peak = Math.max(1, ...months.flatMap((month) => [month.income, month.spending]));

  if (transactions.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--mint-line)] bg-white px-6 py-16 text-center shadow-sm">
        <p className="font-display text-2xl">Nothing to compare yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--mint-muted)]">
          Once activity is saved, this page shows money in, money out, and what’s left each
          month.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Total label="Money in" value={formatPlainMoney(totals.income, totals.currency)} />
        <Total label="Money out" value={formatPlainMoney(totals.spending, totals.currency)} />
        <Total label="Left over" value={formatPlainMoney(totals.net, totals.currency)} />
      </section>

      <section className="rounded-2xl border border-[var(--mint-line)] bg-white shadow-sm">
        <div className="border-b border-[var(--mint-line)] px-5 py-4">
          <h2 className="font-display text-xl">Each month</h2>
          <p className="mt-1 text-xs text-[var(--mint-muted)]">
            Green is money in. Dark is money out. The number on the right is what’s left.
          </p>
        </div>
        <ul>
          {months.map((month) => (
            <li
              key={month.month}
              className="grid gap-3 border-b border-[var(--mint-line)] px-5 py-4 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)_8rem] sm:items-center"
            >
              <p className="text-sm font-medium">{month.label}</p>
              <div className="flex flex-col gap-1.5">
                <Bar
                  width={(month.income / peak) * 100}
                  className="bg-[var(--mint-leaf)]"
                  amount={formatPlainMoney(month.income, month.currency)}
                  label="Money in"
                />
                <Bar
                  width={(month.spending / peak) * 100}
                  className="bg-[var(--mint-ink)]"
                  amount={formatPlainMoney(month.spending, month.currency)}
                  label="Money out"
                />
              </div>
              <p className="text-right text-sm font-medium tabular-nums">
                {formatPlainMoney(month.net, month.currency)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-[var(--mint-line)] bg-white px-5 py-4 shadow-sm">
      <p className="text-xs tracking-wide text-[var(--mint-muted)] uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
    </article>
  );
}

function Bar({
  width,
  className,
  amount,
  label,
}: {
  width: number;
  className: string;
  amount: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--mint-mist)]">
        <div
          className={`h-2 rounded-full ${className}`}
          style={{ width: `${Math.max(width, width > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-[var(--mint-muted)]">
        {amount}
      </span>
      <span className="sr-only">
        {label} {amount}
      </span>
    </div>
  );
}
