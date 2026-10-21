import { NextResponse } from "next/server";
import { taxonomyFailureResponse } from "@/lib/api-error";
import { TaxonomyError } from "@/lib/categorize";
import { setManualLabel } from "@/lib/taxonomy-store";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      itemId?: unknown;
      transactionId?: unknown;
      categoryId?: unknown;
      tags?: unknown;
    };
    if (typeof body.itemId !== "string" || typeof body.transactionId !== "string") {
      throw new TaxonomyError("Transaction not found.", 404);
    }
    if (body.categoryId != null && typeof body.categoryId !== "string") {
      throw new TaxonomyError("Choose a category.");
    }
    await setManualLabel({
      itemId: body.itemId,
      transactionId: body.transactionId,
      categoryId: body.categoryId ?? null,
      tags: body.tags,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = taxonomyFailureResponse(error);
    if (response) return response;
    throw error;
  }
}
