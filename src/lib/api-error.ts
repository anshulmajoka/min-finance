import { NextResponse } from "next/server";
import { isMongoUnavailable, MongoNotConfiguredError } from "@/lib/mongo";

export function mongoFailureResponse(error: unknown) {
  if (error instanceof MongoNotConfiguredError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (isMongoUnavailable(error)) {
    return NextResponse.json(
      {
        error:
          "Could not reach MongoDB. Run MongoDB on mongodb://127.0.0.1:27017, or set MONGODB_URI to your database.",
      },
      { status: 503 },
    );
  }

  return null;
}
