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
