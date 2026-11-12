import { NextResponse } from "next/server";
import { getAllowedEmails, getAuth } from "@/lib/auth";

export async function getRequestSession(headers: Headers) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers });
  if (!session?.user || !getAllowedEmails().includes(session.user.email.toLowerCase())) {
    return null;
  }
  return session;
}

export async function requireApiAuth(request: Request) {
  try {
    const session = await getRequestSession(request.headers);
    if (session?.user) return null;
  } catch {
    // Fail closed when the session store is unavailable.
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
