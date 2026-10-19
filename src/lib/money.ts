export function formatPlainMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

export function formatSignedMoney(amount: number, currency: string) {
  const formatted = formatPlainMoney(Math.abs(amount), currency);
  if (amount > 0) return `−${formatted}`;
  if (amount < 0) return `+${formatted}`;
  return formatted;
}

export function formatShortDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatMonthLabel(month: string) {
  const parsed = new Date(`${month}-01T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function currentMonthKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export function currentDayKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function daysUntil(date: string, now = new Date()) {
  const due = new Date(`${date.slice(0, 10)}T12:00:00`);
  const today = new Date(`${currentDayKey(now)}T12:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function formatDueLabel(date: string, now = new Date()) {
  const days = daysUntil(date, now);
  if (days >= 0 && days < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
      new Date(`${date.slice(0, 10)}T12:00:00`),
    );
  }
  return formatShortDate(date.slice(0, 10));
}
