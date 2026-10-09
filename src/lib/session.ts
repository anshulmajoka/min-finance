import { cookies } from "next/headers";

const ACCESS_TOKEN_COOKIE = "mint_plaid_access_token";
const ITEM_ID_COOKIE = "mint_plaid_item_id";
const CURSOR_COOKIE = "mint_plaid_cursor";
const INSTITUTION_COOKIE = "mint_plaid_institution";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export async function getPlaidSession() {
  const jar = await cookies();
  return {
    accessToken: jar.get(ACCESS_TOKEN_COOKIE)?.value ?? null,
    itemId: jar.get(ITEM_ID_COOKIE)?.value ?? null,
    cursor: jar.get(CURSOR_COOKIE)?.value ?? null,
    institutionName: jar.get(INSTITUTION_COOKIE)?.value ?? null,
  };
}

export async function setPlaidSession(params: {
  accessToken: string;
  itemId: string;
  institutionName?: string | null;
}) {
  const jar = await cookies();
  jar.set(ACCESS_TOKEN_COOKIE, params.accessToken, cookieOptions);
  jar.set(ITEM_ID_COOKIE, params.itemId, cookieOptions);
  jar.delete(CURSOR_COOKIE);
  if (params.institutionName) {
    jar.set(INSTITUTION_COOKIE, params.institutionName, cookieOptions);
  } else {
    jar.delete(INSTITUTION_COOKIE);
  }
}

export async function setPlaidCursor(cursor: string) {
  const jar = await cookies();
  jar.set(CURSOR_COOKIE, cursor, cookieOptions);
}

export async function clearPlaidSession() {
  const jar = await cookies();
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(ITEM_ID_COOKIE);
  jar.delete(CURSOR_COOKIE);
  jar.delete(INSTITUTION_COOKIE);
}
