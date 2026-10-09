import { NextResponse } from "next/server";
import { clearPlaidSession } from "@/lib/session";

export async function POST() {
  await clearPlaidSession();
  return NextResponse.json({ ok: true });
}
