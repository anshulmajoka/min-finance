import { NextResponse } from "next/server";
import { mongoFailureResponse } from "@/lib/api-error";
import { listItems, saveLinkedItem } from "@/lib/finance-store";
import {
  getPlaidClient,
  getPlaidCountryCodes,
  isPlaidConfigured,
  plaidErrorMessage,
} from "@/lib/plaid";
import { getOrCreateUserId } from "@/lib/session";
import { syncItem } from "@/lib/sync-transactions";

export async function POST(request: Request) {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured." },
      { status: 503 },
    );
  }

  let body: {
    public_token?: string;
    institution_name?: string | null;
    institution_id?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.public_token) {
    return NextResponse.json(
      { error: "Missing public_token." },
      { status: 400 },
    );
  }

  try {
    const userId = await getOrCreateUserId();
    const client = getPlaidClient();
    const exchange = await client.itemPublicTokenExchange({
      public_token: body.public_token,
    });

    let institutionId = body.institution_id ?? null;
    let institutionName = body.institution_name ?? null;

    try {
      const item = await client.itemGet({
        access_token: exchange.data.access_token,
      });
      institutionId = institutionId ?? item.data.item.institution_id ?? null;
      if (!institutionName && institutionId) {
        const institution = await client.institutionsGetById({
          institution_id: institutionId,
          country_codes: getPlaidCountryCodes(),
        });
        institutionName = institution.data.institution.name;
      }
    } catch {
      // The Link metadata is enough to store the item. Sync can still run.
    }

    await saveLinkedItem({
      userId,
      itemId: exchange.data.item_id,
      accessToken: exchange.data.access_token,
      institutionId,
      institutionName,
    });

    const [stored] = (await listItems(userId)).filter(
      (item) => item.itemId === exchange.data.item_id,
    );

    let syncError: string | null = null;
    if (stored) {
      try {
        await syncItem(stored);
      } catch (error) {
        syncError = plaidErrorMessage(
          error,
          "The institution was saved, but transactions could not be synced yet.",
        );
      }
    }

    return NextResponse.json({
      ok: true,
      item_id: exchange.data.item_id,
      institution_name: institutionName,
      sync_error: syncError,
    });
  } catch (error) {
    const mongoResponse = mongoFailureResponse(error);
    if (mongoResponse) return mongoResponse;
    return NextResponse.json(
      { error: plaidErrorMessage(error, "Failed to exchange public token.") },
      { status: 500 },
    );
  }
}
