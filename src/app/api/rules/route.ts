import { NextResponse } from "next/server";
import { taxonomyFailureResponse } from "@/lib/api-error";
import { createRule, listRules, reorderRules } from "@/lib/taxonomy-store";

export async function GET() {
  try {
    const rules = await listRules();
    return NextResponse.json({ rules });
  } catch (error) {
    const response = taxonomyFailureResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rule = await createRule(body);
    return NextResponse.json({ rule });
  } catch (error) {
    const response = taxonomyFailureResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { orderedIds?: string[] };
    await reorderRules(body.orderedIds ?? []);
    const rules = await listRules();
    return NextResponse.json({ rules });
  } catch (error) {
    const response = taxonomyFailureResponse(error);
    if (response) return response;
    throw error;
  }
}
