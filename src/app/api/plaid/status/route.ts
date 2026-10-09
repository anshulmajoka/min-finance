import { NextResponse } from "next/server";
import { listInstitutionSummaries } from "@/lib/finance-store";
import {
  isMongoConfigured,
  isMongoUnavailable,
  MongoNotConfiguredError,
  pingMongo,
} from "@/lib/mongo";
import { getPlaidConfig, isPlaidConfigured } from "@/lib/plaid";
import { getOrCreateUserId } from "@/lib/session";

export async function GET() {
  const configured = isPlaidConfigured();
  const { env, products } = getPlaidConfig();
  const mongoConfigured = isMongoConfigured();

  let mongoOk = false;
  let mongoError: string | null = null;
  let institutions: Awaited<ReturnType<typeof listInstitutionSummaries>> = [];

  if (!mongoConfigured) {
    mongoError =
      "MongoDB is not configured. Add MONGODB_URI to your environment.";
  } else {
    try {
      await pingMongo();
      mongoOk = true;
      const userId = await getOrCreateUserId();
      institutions = await listInstitutionSummaries(userId);
    } catch (error) {
      if (error instanceof MongoNotConfiguredError) {
        mongoError = error.message;
      } else if (isMongoUnavailable(error)) {
        mongoError =
          "Could not reach MongoDB. Run MongoDB on mongodb://127.0.0.1:27017, or set MONGODB_URI to your database.";
      } else {
        mongoError =
          error instanceof Error
            ? error.message
            : "Could not read linked institutions.";
      }
    }
  }

  return NextResponse.json({
    configured,
    env,
    products,
    mongoConfigured,
    mongoOk,
    mongoError,
    connected: institutions.length > 0,
    institutions,
  });
}
