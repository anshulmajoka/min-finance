import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/auth-guard";
import { LoginForm } from "@/components/login-form";

export const instant = false;

export default async function LoginPage() {
  const session = await getRequestSession(await headers());
  if (session?.user) redirect("/");

  return <LoginForm />;
}
