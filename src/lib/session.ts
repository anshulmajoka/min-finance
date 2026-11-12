import { cookies, headers } from "next/headers";
import { importLegacyItem } from "@/lib/finance-store";
import { getRequestSession } from "@/lib/auth-guard";

const ACCESS_TOKEN_COOKIE = "mint_plaid_access_token";
const ITEM_ID_COOKIE = "mint_plaid_item_id";
const CURSOR_COOKIE = "mint_plaid_cursor";
const INSTITUTION_COOKIE = "mint_plaid_institution";

// Sandbox uses one shared Plaid account. Saved institutions and transactions
// are reused on every visit instead of asking for a new Link session.
export const SHARED_USER_ID = "sandbox";

export async function getUserId() {
  const session = await getRequestSession(await headers());
  if (!session?.user) throw new Error("Unauthorized");
  return SHARED_USER_ID;
}

export async function getOrCreateUserId() {
  const userId = await getUserId();
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken) {
    await importLegacyItem({
      userId,
      itemId: jar.get(ITEM_ID_COOKIE)?.value || `legacy-${userId}`,
      accessToken,
      institutionName: jar.get(INSTITUTION_COOKIE)?.value ?? null,
    });
    jar.delete(ACCESS_TOKEN_COOKIE);
    jar.delete(ITEM_ID_COOKIE);
    jar.delete(CURSOR_COOKIE);
    jar.delete(INSTITUTION_COOKIE);
  }

  return userId;
}

export async function clearLegacyPlaidCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(ITEM_ID_COOKIE);
  jar.delete(CURSOR_COOKIE);
  jar.delete(INSTITUTION_COOKIE);
}
