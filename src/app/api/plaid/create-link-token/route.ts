import { Products } from "plaid";
import { NextResponse } from "next/server";
import { mongoFailureResponse } from "@/lib/api-error";
import {
  getPlaidClient,
  getPlaidCountryCodes,
  getPlaidProducts,
  isPlaidConfigured,
  plaidErrorCode,
  plaidErrorMessage,
} from "@/lib/plaid";
import { listItems } from "@/lib/finance-store";
import { getOrCreateUserId } from "@/lib/session";

export async function POST(request: Request) {
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
    let itemId: string | null = null;
    try {
      const body = (await request.json()) as { itemId?: string };
      itemId = body.itemId?.trim() || null;
    } catch {
      itemId = null;
    }

    if (itemId) {
      const item = (await listItems(userId)).find((candidate) => candidate.itemId === itemId);
      if (!item) {
        return NextResponse.json({ error: "That institution is not linked." }, { status: 404 });
      }
      const response = await client.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "Mint Finance",
        country_codes: getPlaidCountryCodes(),
        language: "en",
        access_token: item.accessToken,
        additional_consented_products: [Products.Liabilities],
      });
      return NextResponse.json({ link_token: response.data.link_token, update: true });
    }

    const linkRequest = {
      user: { client_user_id: userId },
      client_name: "Mint Finance",
      products: getPlaidProducts(),
      country_codes: getPlaidCountryCodes(),
      language: "en" as const,
      transactions: { days_requested: 730 },
    };
    let response;
    try {
      response = await client.linkTokenCreate({
        ...linkRequest,
        additional_consented_products: [Products.Liabilities],
      });
    } catch (error) {
      if (plaidErrorCode(error) !== "INVALID_PRODUCT") throw error;
      response = await client.linkTokenCreate(linkRequest);
    }

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
