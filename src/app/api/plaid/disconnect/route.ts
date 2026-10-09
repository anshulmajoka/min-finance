import { NextResponse } from "next/server";
import { mongoFailureResponse } from "@/lib/api-error";
import { deleteAllItems, deleteItem } from "@/lib/finance-store";
import { getPlaidClient, plaidErrorMessage } from "@/lib/plaid";
import { clearLegacyPlaidCookies, getUserId } from "@/lib/session";

async function removePlaidItem(accessToken: string) {
  try {
    const client = getPlaidClient();
    await client.itemRemove({ access_token: accessToken });
  } catch (error) {
    console.error(
      "Plaid itemRemove failed:",
      plaidErrorMessage(error, "Unknown Plaid error"),
    );
  }
}

export async function POST(request: Request) {
  let itemId: string | null = null;
  try {
    const body = (await request.json()) as { itemId?: string };
    itemId = body.itemId?.trim() || null;
  } catch {
    itemId = null;
  }

  try {
    await clearLegacyPlaidCookies();
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    if (itemId) {
      const accessToken = await deleteItem(userId, itemId);
      if (accessToken) await removePlaidItem(accessToken);
      return NextResponse.json({ ok: true, itemId });
    }

    const accessTokens = await deleteAllItems(userId);
    await Promise.all(accessTokens.map((token) => removePlaidItem(token)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mongoResponse = mongoFailureResponse(error);
    if (mongoResponse) return mongoResponse;
    throw error;
  }
}
