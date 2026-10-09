import { NextResponse } from "next/server";
import { getPlaidConfig, isPlaidConfigured } from "@/lib/plaid";
import { getPlaidSession } from "@/lib/session";

export async function GET() {
  const configured = isPlaidConfigured();
  const { env, products } = getPlaidConfig();
  const session = await getPlaidSession();

  return NextResponse.json({
    configured,
    env,
    products,
    connected: Boolean(session.accessToken),
    institutionName: session.institutionName,
  });
}
