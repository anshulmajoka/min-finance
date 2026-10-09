import { NextResponse } from "next/server";
import {
  getPlaidClient,
  getPlaidCountryCodes,
  getPlaidProducts,
  isPlaidConfigured,
  plaidErrorMessage,
} from "@/lib/plaid";

export async function POST() {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      {
        error:
          "Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your .env.local file.",
      },
      { status: 503 },
    );
  }

  try {
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: "mint-finance-demo-user" },
      client_name: "Mint Finance",
      products: getPlaidProducts(),
      country_codes: getPlaidCountryCodes(),
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    return NextResponse.json(
      { error: plaidErrorMessage(error, "Failed to create Plaid Link token.") },
      { status: 500 },
    );
  }
}
