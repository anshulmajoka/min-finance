import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { importLegacyItem } from "@/lib/finance-store";

const USER_COOKIE = "mint_user_id";
const ACCESS_TOKEN_COOKIE = "mint_plaid_access_token";
const ITEM_ID_COOKIE = "mint_plaid_item_id";
const CURSOR_COOKIE = "mint_plaid_cursor";
const INSTITUTION_COOKIE = "mint_plaid_institution";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

export async function getUserId() {
  const jar = await cookies();
  return jar.get(USER_COOKIE)?.value ?? null;
}

export async function getOrCreateUserId() {
  const jar = await cookies();
  let userId = jar.get(USER_COOKIE)?.value;
  if (!userId) {
    userId = randomUUID();
    jar.set(USER_COOKIE, userId, cookieOptions);
  }

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
