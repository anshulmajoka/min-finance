import { NextResponse } from "next/server";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid";
import { setPlaidSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured." },
      { status: 503 },
    );
  }

  let body: { public_token?: string; institution_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.public_token) {
    return NextResponse.json(
      { error: "Missing public_token." },
      { status: 400 },
    );
  }

  try {
    const client = getPlaidClient();
    const exchange = await client.itemPublicTokenExchange({
      public_token: body.public_token,
    });

    await setPlaidSession({
      accessToken: exchange.data.access_token,
      itemId: exchange.data.item_id,
      institutionName: body.institution_name ?? null,
    });

    return NextResponse.json({
      ok: true,
      item_id: exchange.data.item_id,
      institution_name: body.institution_name ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to exchange public token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
