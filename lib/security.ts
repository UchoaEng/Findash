import { argon2idAsync } from "@noble/hashes/argon2.js";
const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const bytes = (s: string) =>
  new Uint8Array(s.match(/../g)!.map((x) => parseInt(x, 16)));
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const recoveryCode = () =>
  hex(crypto.getRandomValues(new Uint8Array(20)))
    .toUpperCase()
    .match(/.{1,5}/g)!
    .join("-");
export async function digest(s: string) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  );
}
export async function hashPassword(
  password: string,
  salt = hex(crypto.getRandomValues(new Uint8Array(16))),
) {
  const value = await argon2idAsync(password, bytes(salt), {
    t: 2,
    m: 19456,
    p: 1,
    dkLen: 32,
    asyncTick: 10,
  });
  return `argon2id$${salt}$${hex(value)}`;
}
export async function verifyPassword(password: string, hash: string) {
  const expected = await hashPassword(password, hash.split("$")[1]);
  return constantEqual(hash, expected);
}
export function constantEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export const normalizeUsername = (s: string) =>
  s.normalize("NFKC").trim().toLowerCase();
export const normalizeRecovery = (s: string) =>
  s.replace(/[^a-f0-9]/gi, "").toUpperCase();
