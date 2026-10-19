import { NextResponse } from "next/server";
import { mongoFailureResponse } from "@/lib/api-error";
import { listInstitutionSummaries } from "@/lib/finance-store";
import { isPlaidConfigured } from "@/lib/plaid";
import { getOrCreateUserId } from "@/lib/session";
import { refreshBalances } from "@/lib/sync-transactions";

export async function POST(request: Request) {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured." },
      { status: 503 },
    );
  }

  let itemId: string | null = null;
  try {
    const body = (await request.json()) as { itemId?: string };
    itemId = body.itemId?.trim() || null;
  } catch {
    itemId = null;
  }

  try {
    const userId = await getOrCreateUserId();
    const institutions = await listInstitutionSummaries(userId);
    if (institutions.length === 0) {
      return NextResponse.json(
        { error: "No bank account connected. Link an account first." },
        { status: 401 },
      );
    }

    const errors = await refreshBalances(userId, itemId);
    const freshInstitutions = await listInstitutionSummaries(userId);
    return NextResponse.json({ institutions: freshInstitutions, errors });
  } catch (error) {
    const mongoResponse = mongoFailureResponse(error);
    if (mongoResponse) return mongoResponse;
    throw error;
  }
}
