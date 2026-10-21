import { NextResponse } from "next/server";
import { taxonomyFailureResponse } from "@/lib/api-error";
import { createCategory, listCategories } from "@/lib/taxonomy-store";

export async function GET() {
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
