import { NextResponse } from "next/server";
import { mongoFailureResponse } from "@/lib/api-error";
import {
  listInstitutionSummaries,
  listTransactions,
} from "@/lib/finance-store";
import { isPlaidConfigured } from "@/lib/plaid";
import { getOrCreateUserId } from "@/lib/session";
import { syncItems } from "@/lib/sync-transactions";

async function loadTransactions(
  mode: "missing" | "incremental",
  itemId?: string | null,
) {
  if (mode === "incremental" && !isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured." },
      { status: 503 },
    );
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

    const sync = isPlaidConfigured()
      ? await syncItems(userId, mode, itemId)
      : {
          attempted: false,
          errors: [],
          totals: { added: 0, modified: 0, removed: 0 },
        };
    const transactions = await listTransactions(userId, itemId);
    const freshInstitutions = await listInstitutionSummaries(userId);

    return NextResponse.json({
      institutions: freshInstitutions,
      transactions,
      sync: sync.attempted ? sync.totals : null,
      errors: sync.errors,
    });
  } catch (error) {
    const mongoResponse = mongoFailureResponse(error);
    if (mongoResponse) return mongoResponse;
    throw error;
  }
}

export async function GET(request: Request) {
  const itemId = new URL(request.url).searchParams.get("itemId");
  return loadTransactions("missing", itemId);
}

export async function POST(request: Request) {
  let itemId: string | null = null;
  try {
    const body = (await request.json()) as { itemId?: string };
    itemId = body.itemId ?? null;
  } catch {
    itemId = null;
  }
  return loadTransactions("incremental", itemId);
}
