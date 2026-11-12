import { NextResponse } from "next/server";
import { taxonomyFailureResponse } from "@/lib/api-error";
import { createRule, listRules, reorderRules } from "@/lib/taxonomy-store";
import { requireApiAuth } from "@/lib/auth-guard";

export async function GET(request: Request) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;
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
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;
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
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;
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
