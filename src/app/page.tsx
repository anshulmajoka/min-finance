import { MintApp } from "@/components/mint-app";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/auth-guard";

export const instant = false;

export default async function Home() {
  const session = await getRequestSession(await headers());
  if (!session?.user) redirect("/login");
  return <MintApp />;
}
