import type { AppView } from "@/components/app-shell";

const COPY: Partial<Record<AppView, { title: string; body: string }>> = {
  budget: {
    title: "Budgets are next",
    body: "You’ll set a monthly limit for spending here. Until then, Home and Cash flow already show what came in and what went out.",
  },
  recurring: {
    title: "Bills are next",
    body: "Subscriptions and repeating bills will be listed here. Activity already has every transaction if you want to look one up now.",
  },
  goals: {
    title: "Goals are next",
    body: "Savings targets, such as an emergency fund, will live here. Nothing is set up yet.",
  },
};

export function ComingSoon({ view }: { view: AppView }) {
  const copy = COPY[view] ?? {
    title: "Coming next",
    body: "This personal screen is not filled in yet.",
  };

  return (
    <section className="rounded-2xl border border-[var(--mint-line)] bg-white px-6 py-16 text-center shadow-sm">
      <p className="font-display text-2xl text-[var(--mint-ink)]">{copy.title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--mint-muted)]">
        {copy.body}
      </p>
    </section>
  );
}
