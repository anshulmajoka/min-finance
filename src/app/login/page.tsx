import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/auth-guard";
import { LoginForm } from "@/components/login-form";
import { isAuthDisabled } from "@/lib/auth";

export const instant = false;

export default async function LoginPage() {
  const session = await getRequestSession(await headers());
  if (isAuthDisabled() || session?.user) redirect("/");

  return <LoginForm />;
}
