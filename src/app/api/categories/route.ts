import { NextResponse } from "next/server";
import { taxonomyFailureResponse } from "@/lib/api-error";
import { createCategory, listCategories } from "@/lib/taxonomy-store";
import { requireApiAuth } from "@/lib/auth-guard";

export async function GET(request: Request) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const categories = await listCategories();
    return NextResponse.json({ categories });
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
    const category = await createCategory(body);
    return NextResponse.json({ category });
  } catch (error) {
    const response = taxonomyFailureResponse(error);
    if (response) return response;
    throw error;
  }
}
