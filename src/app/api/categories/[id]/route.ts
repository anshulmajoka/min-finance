import { NextResponse } from "next/server";
import { taxonomyFailureResponse } from "@/lib/api-error";
import { deleteCategory, updateCategory } from "@/lib/taxonomy-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
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

export async function DELETE(_request: Request, context: RouteContext) {
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
