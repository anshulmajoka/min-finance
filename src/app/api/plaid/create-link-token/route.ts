import { NextResponse } from "next/server";
import { mongoFailureResponse } from "@/lib/api-error";
import {
  getPlaidClient,
  getPlaidCountryCodes,
  getPlaidProducts,
  isPlaidConfigured,
  plaidErrorMessage,
} from "@/lib/plaid";
import { getOrCreateUserId } from "@/lib/session";

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
    const userId = await getOrCreateUserId();
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Mint Finance",
      products: getPlaidProducts(),
      country_codes: getPlaidCountryCodes(),
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    const mongoResponse = mongoFailureResponse(error);
    if (mongoResponse) return mongoResponse;
    return NextResponse.json(
      { error: plaidErrorMessage(error, "Failed to create Plaid Link token.") },
      { status: 500 },
    );
  }
}
