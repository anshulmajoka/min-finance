import { loadEnvConfig } from "@next/env";
import { getAllowedEmails, getAuth } from "../src/lib/auth";

loadEnvConfig(process.cwd());

async function readHidden(prompt: string) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Run this setup command in an interactive terminal.");
  }
  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (key: Buffer) => {
      if (key[0] === 3) {
        cleanup();
        reject(new Error("Cancelled."));
      } else if (key[0] === 13 || key[0] === 10) {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
      } else if (key[0] === 8 || key[0] === 127) {
        value = value.slice(0, -1);
      } else if (key[0] >= 32) {
        value += key.toString();
      }
    };
    function cleanup() {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    }
    stdin.on("data", onData);
  });
}

async function main() {
  const emails = getAllowedEmails();
  const auth = await getAuth();
  const context = await auth.$context;

  for (const email of emails) {
    const existing = await context.internalAdapter.findUserByEmail(email);
    if (existing) {
      console.log(`${email}: account already exists; left unchanged.`);
      continue;
    }

    let password = await readHidden(`Create password for ${email} (12-128 characters): `);
    if (password.length < 12 || password.length > 128) {
      password = "";
      throw new Error("Password must be between 12 and 128 characters.");
    }
    const confirmation = await readHidden("Confirm password: ");
    if (password !== confirmation) {
      password = "";
      throw new Error("Passwords did not match.");
    }

    const user = await context.internalAdapter.createUser({
      email,
      name: email.split("@")[0],
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { method: "email-password" });
    await context.internalAdapter.linkAccount({
      accountId: user.id,
      providerId: "credential",
      password: await context.password.hash(password),
      userId: user.id,
    });
    password = "";
    console.log(`${email}: account created.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Account setup failed.");
  process.exitCode = 1;
});
