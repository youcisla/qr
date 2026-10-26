import { createHash, timingSafeEqual } from "node:crypto"
import { db } from "$lib/server/db"
import { apiKeysTable, type ApiKey } from "$lib/server/db/schema"
import { and, desc, eq, isNull } from "drizzle-orm"
import { customAlphabet } from "nanoid"

/** Public prefix of every API secret. */
export const API_KEY_SECRET_PREFIX = "yq_"
/** Number of leading characters stored as the lookup prefix. */
const KEY_PREFIX_LENGTH = 12

const createSecretBody = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  40,
)

export interface CreateApiKeyResult {
  apiKey: ApiKey
  /** Full secret. Only returned once, at creation time. */
  secret: string
}

export interface AuthenticatedApiKey {
  apiKeyId: string
  userId: string
}

/** API keys are high-entropy random strings, so a plain SHA-256 digest is sufficient. */
function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

export async function createApiKey(userId: string, name: string): Promise<CreateApiKeyResult> {
  const trimmedName = name.trim().slice(0, 60) || "API key"
  const secret = `${API_KEY_SECRET_PREFIX}${createSecretBody()}`
  const prefix = secret.slice(0, KEY_PREFIX_LENGTH)
  const keyHash = hashSecret(secret)

  const [apiKey] = await db
    .insert(apiKeysTable)
    .values({ userId, name: trimmedName, prefix, keyHash })
    .returning()

  return { apiKey, secret }
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  return db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, userId))
    .orderBy(desc(apiKeysTable.createdAt))
}

/** Revoke an owned key. Returns false when the key is missing or owned by someone else. */
export async function revokeApiKey(id: string, userId: string): Promise<boolean> {
  const revoked = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, userId), isNull(apiKeysTable.revokedAt)),
    )
    .returning({ id: apiKeysTable.id })
  return revoked.length > 0
}

/** Verify a bearer secret and return its owner. Updates lastUsedAt on success. */
export async function verifyApiKey(
  secret: string | null | undefined,
): Promise<AuthenticatedApiKey | null> {
  if (!secret) return null
  const trimmed = secret.trim()
  if (!trimmed.startsWith(API_KEY_SECRET_PREFIX)) return null

  const prefix = trimmed.slice(0, KEY_PREFIX_LENGTH)
  const candidates = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.prefix, prefix), isNull(apiKeysTable.revokedAt)))
  if (candidates.length === 0) return null

  const actual = Buffer.from(hashSecret(trimmed), "hex")
  const record = candidates.find((candidate) => {
    const expected = Buffer.from(candidate.keyHash, "hex")
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  })
  if (!record) return null

  await db
    .update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, record.id))

  return { apiKeyId: record.id, userId: record.userId }
}

/** Resolve the API key from an Authorization: Bearer header. */
export async function authenticateApiRequest(
  request: Request,
): Promise<AuthenticatedApiKey | null> {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return verifyApiKey(match?.[1] ?? null)
}

/** Shape safe to return to clients (never includes keyHash). */
export function toPublicApiKey(apiKey: ApiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    lastUsedAt: apiKey.lastUsedAt,
    createdAt: apiKey.createdAt,
    revokedAt: apiKey.revokedAt,
  }
}
