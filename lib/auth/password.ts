import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const ROUNDS = 12;
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

let dummyHash: Promise<string> | null = null;

function placeholderHash(): Promise<string> {
  dummyHash ??= bcrypt.hash("not-a-real-broker-password", ROUNDS);
  return dummyHash;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  try {
    const compareHash = hash ?? (await placeholderHash());
    const matches = await bcrypt.compare(password, compareHash);
    return Boolean(hash) && matches;
  } catch {
    return false;
  }
}

export function generateTemporaryPassword(length = 16): string {
  const bytes = randomBytes(length);
  let password = "";
  for (const byte of bytes) {
    password += TEMP_ALPHABET[byte % TEMP_ALPHABET.length];
  }
  return password;
}
