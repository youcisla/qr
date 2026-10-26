import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"

/** Minimum accepted length for QR password protection. */
export const MIN_PASSWORD_LENGTH = 4
/** Upper bound to keep scrypt work bounded. */
export const MAX_PASSWORD_LENGTH = 128

const KEY_LENGTH = 64
const SALT_LENGTH = 16
const HASH_PREFIX = "scrypt"
const HASH_SEPARATOR = "$"

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

/**
 * Hash a QR unlock password with scrypt (node:crypto, no extra dependency).
 * Format: scrypt$<salt hex>$<derived key hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = await deriveKey(password.normalize("NFKC"), salt)
  return [HASH_PREFIX, salt.toString("hex"), key.toString("hex")].join(HASH_SEPARATOR)
}

/** Constant-time verification of a password against a stored scrypt hash. */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash) return false
  const parts = storedHash.split(HASH_SEPARATOR)
  if (parts.length !== 3 || parts[0] !== HASH_PREFIX) return false
  const salt = Buffer.from(parts[1], "hex")
  const expected = Buffer.from(parts[2], "hex")
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false
  const actual = await deriveKey(password.normalize("NFKC"), salt)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** True when a QR code is password protected. */
export function hasPassword(hash: string | null | undefined): hash is string {
  return typeof hash === "string" && hash.length > 0
}
