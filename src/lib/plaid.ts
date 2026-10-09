import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

export type PlaidEnvName = "sandbox" | "development" | "production";

export function getPlaidConfig() {
  const clientId = process.env.PLAID_CLIENT_ID?.trim() ?? "";
  const secret = process.env.PLAID_SECRET?.trim() ?? "";
  const env = (process.env.PLAID_ENV?.trim() || "sandbox") as PlaidEnvName;
  const products = (process.env.PLAID_PRODUCTS?.trim() || "transactions")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return { clientId, secret, env, products };
}

export function isPlaidConfigured() {
  const { clientId, secret } = getPlaidConfig();
  return Boolean(clientId && secret);
}

export function getPlaidClient() {
  const { clientId, secret, env } = getPlaidConfig();

  if (!clientId || !secret) {
    throw new Error("Plaid credentials are not configured.");
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

export function getPlaidProducts(): Products[] {
  const { products } = getPlaidConfig();
  const allowed = new Set(Object.values(Products));

  const resolved = products
    .map((name) => name as Products)
    .filter((name) => allowed.has(name));

  return resolved.length > 0 ? resolved : [Products.Transactions];
}

export function getPlaidCountryCodes(): CountryCode[] {
  return [CountryCode.Us];
}
