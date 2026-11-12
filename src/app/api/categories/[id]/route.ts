import { NextResponse } from "next/server";
import { taxonomyFailureResponse } from "@/lib/api-error";
import { deleteCategory, updateCategory } from "@/lib/taxonomy-store";
import { requireApiAuth } from "@/lib/auth-guard";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const category = await updateCategory(id, body);
    return NextResponse.json({ category });
  } catch (error) {
    const response = taxonomyFailureResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    await deleteCategory(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = taxonomyFailureResponse(error);
    if (response) return response;
    throw error;
  }
}
