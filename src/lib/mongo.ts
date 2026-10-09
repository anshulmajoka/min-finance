import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as {
  mongoUri?: string;
  mongoClientPromise?: Promise<MongoClient>;
  mongoIndexesPromise?: Promise<void>;
};

export class MongoNotConfiguredError extends Error {
  constructor() {
    super(
      "MongoDB is not configured. Add MONGODB_URI to your environment.",
    );
    this.name = "MongoNotConfiguredError";
  }
}

export function resolveMongoUri() {
  const fromEnv = process.env.MONGODB_URI?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return null;
  return "mongodb://127.0.0.1:27017";
}

export function isMongoConfigured() {
  return Boolean(resolveMongoUri());
}

export function mongoDatabaseName() {
  return process.env.MONGODB_DB?.trim() || "mint_finance";
}

export function isMongoUnavailable(error: unknown) {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false;
  }
  const name = String((error as { name: string }).name);
  return (
    name === "MongoServerSelectionError" ||
    name === "MongoNetworkError" ||
    name === "MongoNotConnectedError"
  );
}

async function ensureIndexes(db: Db) {
  if (!globalForMongo.mongoIndexesPromise) {
    globalForMongo.mongoIndexesPromise = (async () => {
      await db.collection("items").createIndex(
        { userId: 1, itemId: 1 },
        { unique: true },
      );
      await db.collection("transactions").createIndex(
        { userId: 1, transactionId: 1 },
        { unique: true },
      );
      await db.collection("transactions").createIndex({
        userId: 1,
        itemId: 1,
        date: -1,
      });
    })().catch((error) => {
      globalForMongo.mongoIndexesPromise = undefined;
      throw error;
    });
  }

  await globalForMongo.mongoIndexesPromise;
}

export async function getDb() {
  const uri = resolveMongoUri();
  if (!uri) {
    throw new MongoNotConfiguredError();
  }

  if (
    !globalForMongo.mongoClientPromise ||
    globalForMongo.mongoUri !== uri
  ) {
    globalForMongo.mongoUri = uri;
    globalForMongo.mongoIndexesPromise = undefined;
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    globalForMongo.mongoClientPromise = client.connect().catch((error) => {
      globalForMongo.mongoClientPromise = undefined;
      throw error;
    });
  }

  const client = await globalForMongo.mongoClientPromise;
  const db = client.db(mongoDatabaseName());
  await ensureIndexes(db);
  return db;
}

export async function pingMongo() {
  const db = await getDb();
  await db.command({ ping: 1 });
}
