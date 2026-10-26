import { resolveDesign, type QrDesign } from "$lib/qr/types"
import { db } from "$lib/server/db"
import {
  qrCodesTable,
  qrStylesTable,
  type InsertQrCode,
  type QrCode,
  type QrCodeStatus,
  type QrCodeType,
} from "$lib/server/db/schema"
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm"
import { customAlphabet } from "nanoid"

import { hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password"

/** Length of generated dynamic short codes. */
export const SHORT_CODE_LENGTH = 8

/** Payload length ceiling: QR symbols stop being practically scannable past this. */
const MAX_ENCODED_DATA_LENGTH = 4096
const MAX_CONTENT_DATA_LENGTH = 64_000
const MAX_TITLE_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 40

/** Ambiguous characters (0/o, 1/l/i) are omitted from generated short codes. */
const createShortCode = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", SHORT_CODE_LENGTH)

const RESERVED_SHORT_CODES = new Set([
  "api",
  "auth",
  "dashboard",
  "studio",
  "unlock",
  "scan",
  "login",
  "logout",
  "settings",
  "sitemap",
  "robots",
  "assets",
  "static",
])

export interface QrCodeWithDesign extends QrCode {
  design: QrDesign
}

/**
 * Domain error thrown by the QR services. HTTP routes translate `status` and
 * `message` directly; UI server actions can catch it or let it bubble.
 */
export class QrServiceError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "QrServiceError"
    this.status = status
    this.code = code
  }
}

export interface CreateQrCodeInput {
  userId: string | null
  type?: QrCodeType
  contentType?: string
  contentData?: Record<string, unknown> | null
  encodedData?: string | null
  destinationUrl?: string | null
  title?: string | null
  description?: string | null
  status?: QrCodeStatus
  expiresAt?: Date | string | null
  password?: string | null
  tags?: string[] | null
  design?: Partial<QrDesign> | null
  shortCode?: string | null
}

export interface UpdateQrCodePatch {
  title?: string | null
  description?: string | null
  destinationUrl?: string | null
  contentType?: string
  contentData?: Record<string, unknown> | null
  encodedData?: string | null
  status?: QrCodeStatus
  expiresAt?: Date | string | null
  password?: string | null
  tags?: string[] | null
}

export interface BulkResult {
  succeeded: string[]
  failed: Array<{ id: string; reason: string }>
}

export interface ListQrCodesOptions {
  search?: string
  status?: QrCodeStatus | "all"
  type?: QrCodeType | "all"
  tag?: string
  sort?: "created" | "updated" | "scans" | "title"
  direction?: "asc" | "desc"
  limit?: number
  offset?: number
}

export interface ListQrCodesResult {
  items: QrCodeWithDesign[]
  total: number
}
function normalizeTitle(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const title = value.trim()
  if (!title) return null
  return title.slice(0, MAX_TITLE_LENGTH)
}

function normalizeDescription(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const description = value.trim()
  if (!description) return null
  return description.slice(0, MAX_DESCRIPTION_LENGTH)
}

function normalizeContentType(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "url"
  const contentType = value.trim().toLowerCase()
  if (!/^[a-z0-9-]{1,32}$/.test(contentType)) {
    throw new QrServiceError(400, "invalid_content_type", "Unsupported content type")
  }
  return contentType
}

function normalizeContentData(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (value === null || value === undefined) return {}
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new QrServiceError(400, "invalid_content_data", "Content data must be a JSON object")
  }
  const serialised = JSON.stringify(value)
  if (serialised.length > MAX_CONTENT_DATA_LENGTH) {
    throw new QrServiceError(400, "content_data_too_large", "Content data is too large")
  }
  return value
}

function normalizeEncodedData(value: string | null | undefined): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "string") {
    throw new QrServiceError(400, "invalid_encoded_data", "Encoded payload must be a string")
  }
  if (value.length > MAX_ENCODED_DATA_LENGTH) {
    throw new QrServiceError(
      400,
      "encoded_data_too_long",
      "Encoded payload is too long to scan reliably",
    )
  }
  return value
}

function normalizeDestinationUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new QrServiceError(400, "invalid_url", "Destination must be a valid absolute URL")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new QrServiceError(400, "invalid_url", "Destination URL must use http or https")
  }
  // Keep the user's exact URL (validated above) so the redirect Location is unchanged.
  return trimmed
}

function normalizeExpiresAt(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new QrServiceError(400, "invalid_expiry", "Expiry must be a valid date")
  }
  return date
}

function normalizeTags(tags: string[] | null | undefined): string[] {
  if (!tags) return []
  const normalised: string[] = []
  for (const raw of tags) {
    if (typeof raw !== "string") continue
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH)
    if (!tag) continue
    if (!normalised.includes(tag)) normalised.push(tag)
    if (normalised.length >= MAX_TAGS) break
  }
  return normalised
}

function normalizeShortCode(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const shortCode = value.trim()
  if (!shortCode) return null
  if (
    !/^[a-zA-Z0-9_-]{3,32}$/.test(shortCode) ||
    RESERVED_SHORT_CODES.has(shortCode.toLowerCase())
  ) {
    throw new QrServiceError(
      400,
      "invalid_short_code",
      "Short code must be 3-32 letters, numbers, dashes or underscores and not a reserved word",
    )
  }
  return shortCode
}

function normalizePassword(password: string | null | undefined): Promise<string | null> {
  if (password === null || password === undefined || password === "") return Promise.resolve(null)
  if (typeof password !== "string") {
    throw new QrServiceError(400, "invalid_password", "Password must be a string")
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new QrServiceError(
      400,
      "password_too_short",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    )
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new QrServiceError(400, "password_too_long", "Password is too long")
  }
  return hashPassword(password)
}

function isQrStatus(value: string): value is QrCodeStatus {
  return value === "active" || value === "paused" || value === "archived"
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  )
}

function requireOwnership(qr: QrCode, userId: string): void {
  if (qr.userId !== userId) {
    throw new QrServiceError(403, "forbidden", "You do not have access to this QR code")
  }
}

async function findQrCode(where: SQL<unknown>): Promise<QrCodeWithDesign | null> {
  const [row] = await db
    .select({ qr: qrCodesTable, design: qrStylesTable.design })
    .from(qrCodesTable)
    .leftJoin(qrStylesTable, eq(qrStylesTable.qrCodeId, qrCodesTable.id))
    .where(where)
    .limit(1)
  if (!row) return null
  return { ...row.qr, design: resolveDesign(row.design) }
}
/** Lookup a QR code (with its design) by id, regardless of owner. */
export async function getQrCodeById(id: string): Promise<QrCodeWithDesign | null> {
  return findQrCode(eq(qrCodesTable.id, id))
}

/** Lookup a QR code by its dynamic short code (used by the redirect + unlock routes). */
export async function getQrCodeByShortCode(shortCode: string): Promise<QrCode | null> {
  const [qrCode] = await db
    .select()
    .from(qrCodesTable)
    .where(eq(qrCodesTable.shortCode, shortCode))
    .limit(1)
  return qrCode ?? null
}

/**
 * Fetch a QR code owned by the given user, with its resolved design.
 * Throws QrServiceError(404) when missing and (403) when owned by someone else.
 */
export async function getQrCodeForUser(id: string, userId: string): Promise<QrCodeWithDesign> {
  const qrCode = await findQrCode(eq(qrCodesTable.id, id))
  if (!qrCode) throw new QrServiceError(404, "not_found", "QR code not found")
  requireOwnership(qrCode, userId)
  return qrCode
}

/**
 * Create a QR code together with its style row. Dynamic codes get a unique
 * short code; static codes require an encoded payload.
 */
export async function createQrCode(input: CreateQrCodeInput): Promise<QrCodeWithDesign> {
  const type: QrCodeType = input.type ?? "static"
  const contentType = normalizeContentType(input.contentType)
  const contentData = normalizeContentData(input.contentData)
  const destinationUrl = normalizeDestinationUrl(input.destinationUrl)
  let encodedData = normalizeEncodedData(input.encodedData)
  if (!encodedData && contentType === "url" && destinationUrl) encodedData = destinationUrl

  if (type === "dynamic" && !destinationUrl) {
    throw new QrServiceError(400, "destination_required", "Dynamic QR codes need a destination URL")
  }
  if (type === "static" && !encodedData) {
    throw new QrServiceError(
      400,
      "encoded_data_required",
      "Static QR codes need an encoded payload",
    )
  }

  const passwordHash = await normalizePassword(input.password)
  const design = resolveDesign(input.design ?? null)
  const expiresAt = normalizeExpiresAt(input.expiresAt)
  const title = normalizeTitle(input.title)
  const description = normalizeDescription(input.description)
  const tags = normalizeTags(input.tags)
  const status: QrCodeStatus = input.status ?? "active"
  const customShortCode = type === "dynamic" ? normalizeShortCode(input.shortCode) : null

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shortCode = customShortCode ?? (type === "dynamic" ? createShortCode() : null)
    try {
      const created = await db.transaction(async (tx) => {
        const [qrCode] = await tx
          .insert(qrCodesTable)
          .values({
            userId: input.userId ?? null,
            shortCode,
            contentType,
            contentData,
            encodedData,
            destinationUrl,
            title,
            description,
            type,
            status,
            expiresAt,
            passwordHash,
            tags,
          })
          .returning()
        await tx.insert(qrStylesTable).values({ qrCodeId: qrCode.id, design })
        return qrCode
      })
      return { ...created, design }
    } catch (error) {
      if (isUniqueViolation(error)) {
        if (customShortCode) {
          throw new QrServiceError(409, "short_code_taken", "That short code is already in use")
        }
        continue
      }
      throw error
    }
  }

  throw new QrServiceError(500, "short_code_exhausted", "Could not allocate a unique short code")
}

/**
 * Update a QR code's metadata/content/lifecycle fields.
 * `undefined` leaves a field untouched; `null` clears nullable fields;
 * `password: null` or `""` removes password protection.
 */
export async function updateQrCode(
  id: string,
  userId: string,
  patch: UpdateQrCodePatch,
): Promise<QrCodeWithDesign> {
  const existing = await getQrCodeForUser(id, userId)
  const updates: Partial<InsertQrCode> = {}

  if (patch.title !== undefined) updates.title = normalizeTitle(patch.title)
  if (patch.description !== undefined) {
    updates.description = normalizeDescription(patch.description)
  }

  if (patch.destinationUrl !== undefined) {
    if (existing.type === "static") {
      throw new QrServiceError(
        400,
        "static_destination",
        "Static QR codes cannot change their destination; edit the encoded payload instead",
      )
    }
    const destinationUrl = normalizeDestinationUrl(patch.destinationUrl)
    if (!destinationUrl) {
      throw new QrServiceError(
        400,
        "destination_required",
        "Dynamic QR codes need a destination URL",
      )
    }
    updates.destinationUrl = destinationUrl
  }

  if (patch.contentType !== undefined) {
    updates.contentType = normalizeContentType(patch.contentType)
  }
  if (patch.contentData !== undefined) {
    updates.contentData = normalizeContentData(patch.contentData)
  }
  if (patch.encodedData !== undefined) {
    const encodedData = normalizeEncodedData(patch.encodedData)
    if (existing.type === "static" && !encodedData) {
      throw new QrServiceError(
        400,
        "encoded_data_required",
        "Static QR codes need an encoded payload",
      )
    }
    updates.encodedData = encodedData
  }

  if (patch.status !== undefined) {
    if (!isQrStatus(patch.status)) {
      throw new QrServiceError(400, "invalid_status", "Unsupported QR code status")
    }
    updates.status = patch.status
  }
  if (patch.expiresAt !== undefined) updates.expiresAt = normalizeExpiresAt(patch.expiresAt)
  if (patch.tags !== undefined) updates.tags = normalizeTags(patch.tags)
  if (patch.password !== undefined) updates.passwordHash = await normalizePassword(patch.password)

  if (Object.keys(updates).length === 0) return existing

  updates.updatedAt = new Date()
  await db.update(qrCodesTable).set(updates).where(eq(qrCodesTable.id, id))

  const updated = await findQrCode(eq(qrCodesTable.id, id))
  if (!updated) throw new QrServiceError(404, "not_found", "QR code not found")
  return updated
}

/** Merge a (partial) design into the stored QrDesign and persist it. */
export async function updateQrDesign(
  id: string,
  userId: string,
  design: Partial<QrDesign>,
): Promise<QrDesign> {
  const existing = await getQrCodeForUser(id, userId)
  const nextDesign = resolveDesign({ ...existing.design, ...design })

  const [style] = await db
    .select({ id: qrStylesTable.id })
    .from(qrStylesTable)
    .where(eq(qrStylesTable.qrCodeId, id))
    .limit(1)

  if (style) {
    await db
      .update(qrStylesTable)
      .set({ design: nextDesign, updatedAt: new Date() })
      .where(eq(qrStylesTable.qrCodeId, id))
  } else {
    await db.insert(qrStylesTable).values({ qrCodeId: id, design: nextDesign })
  }

  return nextDesign
}
/** Delete one owned QR code (styles and scan events cascade). */
export async function deleteQrCode(id: string, userId: string): Promise<void> {
  await getQrCodeForUser(id, userId)
  await db.delete(qrCodesTable).where(eq(qrCodesTable.id, id))
}

/** Delete several QR codes in one statement, reporting per-id results. */
export async function deleteQrCodes(ids: string[], userId: string): Promise<BulkResult> {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return { succeeded: [], failed: [] }

  const owned = await db
    .select({ id: qrCodesTable.id })
    .from(qrCodesTable)
    .where(and(inArray(qrCodesTable.id, uniqueIds), eq(qrCodesTable.userId, userId)))
  const ownedIds = owned.map((row) => row.id)

  if (ownedIds.length > 0) {
    await db.delete(qrCodesTable).where(inArray(qrCodesTable.id, ownedIds))
  }

  const succeeded = new Set(ownedIds)
  return {
    succeeded: ownedIds,
    failed: uniqueIds
      .filter((id) => !succeeded.has(id))
      .map((id) => ({ id, reason: "not_found_or_forbidden" })),
  }
}

/** Bulk lifecycle update (activate / pause / archive) for owned QR codes. */
export async function updateQrStatuses(
  ids: string[],
  userId: string,
  status: QrCodeStatus,
): Promise<BulkResult> {
  if (!isQrStatus(status)) {
    throw new QrServiceError(400, "invalid_status", "Unsupported QR code status")
  }
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return { succeeded: [], failed: [] }

  const owned = await db
    .select({ id: qrCodesTable.id })
    .from(qrCodesTable)
    .where(and(inArray(qrCodesTable.id, uniqueIds), eq(qrCodesTable.userId, userId)))
  const ownedIds = owned.map((row) => row.id)

  if (ownedIds.length > 0) {
    await db
      .update(qrCodesTable)
      .set({ status, updatedAt: new Date() })
      .where(inArray(qrCodesTable.id, ownedIds))
  }

  const succeeded = new Set(ownedIds)
  return {
    succeeded: ownedIds,
    failed: uniqueIds
      .filter((id) => !succeeded.has(id))
      .map((id) => ({ id, reason: "not_found_or_forbidden" })),
  }
}

/** Copy a QR code (content + design + tags) under a new short code. */
export async function duplicateQrCode(id: string, userId: string): Promise<QrCodeWithDesign> {
  const source = await getQrCodeForUser(id, userId)
  const title = normalizeTitle(source.title ? `${source.title} (copy)` : "Untitled (copy)")

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shortCode = source.type === "dynamic" ? createShortCode() : null
    try {
      const created = await db.transaction(async (tx) => {
        const [qrCode] = await tx
          .insert(qrCodesTable)
          .values({
            userId,
            shortCode,
            contentType: source.contentType,
            contentData: source.contentData,
            encodedData: source.encodedData,
            destinationUrl: source.destinationUrl,
            title,
            description: source.description,
            type: source.type,
            status: "active",
            expiresAt: source.expiresAt,
            passwordHash: source.passwordHash,
            tags: [...source.tags],
          })
          .returning()
        await tx.insert(qrStylesTable).values({ qrCodeId: qrCode.id, design: source.design })
        return qrCode
      })
      return { ...created, design: source.design }
    } catch (error) {
      if (isUniqueViolation(error)) continue
      throw error
    }
  }

  throw new QrServiceError(500, "short_code_exhausted", "Could not allocate a unique short code")
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (char) => `\\${char}`)
}

/** Paginated, searchable list of a user's QR codes (with designs). */
export async function listQrCodesForUser(
  userId: string,
  options: ListQrCodesOptions = {},
): Promise<ListQrCodesResult> {
  const conditions: SQL<unknown>[] = [eq(qrCodesTable.userId, userId)]

  if (options.search?.trim()) {
    const term = `%${escapeLike(options.search.trim())}%`
    const search = or(
      ilike(qrCodesTable.title, term),
      ilike(qrCodesTable.description, term),
      ilike(qrCodesTable.shortCode, term),
      ilike(qrCodesTable.destinationUrl, term),
      ilike(qrCodesTable.encodedData, term),
    )
    if (search) conditions.push(search)
  }
  if (options.status && options.status !== "all") {
    conditions.push(eq(qrCodesTable.status, options.status))
  }
  if (options.type && options.type !== "all") {
    conditions.push(eq(qrCodesTable.type, options.type))
  }
  if (options.tag?.trim()) {
    const tag = options.tag.trim()
    conditions.push(sql`${qrCodesTable.tags} @> ARRAY[${tag}]::text[]`)
  }

  const where = and(...conditions)
  const [countRow] = await db.select({ total: count() }).from(qrCodesTable).where(where)

  const sort = options.sort ?? "created"
  const direction = options.direction ?? (sort === "title" ? "asc" : "desc")
  const sortColumn =
    sort === "scans"
      ? qrCodesTable.scanCount
      : sort === "title"
        ? qrCodesTable.title
        : sort === "updated"
          ? qrCodesTable.updatedAt
          : qrCodesTable.createdAt
  const orderBy = direction === "asc" ? asc(sortColumn) : desc(sortColumn)
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500)
  const offset = Math.max(options.offset ?? 0, 0)

  const rows = await db
    .select({ qr: qrCodesTable, design: qrStylesTable.design })
    .from(qrCodesTable)
    .leftJoin(qrStylesTable, eq(qrStylesTable.qrCodeId, qrCodesTable.id))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)

  return {
    items: rows.map((row) => ({ ...row.qr, design: resolveDesign(row.design) })),
    total: countRow?.total ?? 0,
  }
}

/**
 * The exact string that must be encoded into the QR image: dynamic codes point
 * at this deployment's short link, static codes embed their payload directly.
 */
export function buildEncodeTarget(
  qr: Pick<QrCode, "type" | "shortCode" | "encodedData" | "destinationUrl">,
  origin: string,
): string {
  if (qr.type === "dynamic" && qr.shortCode) {
    return `${origin.replace(/\/+$/, "")}/${qr.shortCode}`
  }
  return qr.encodedData || qr.destinationUrl || ""
}

/**
 * All owned QR codes (optionally limited to specific ids) for CSV export.
 * Deliberately unpaginated but capped for safety.
 */
export async function getQrCodesForExport(
  userId: string,
  ids?: string[],
): Promise<QrCodeWithDesign[]> {
  const conditions: SQL<unknown>[] = [eq(qrCodesTable.userId, userId)]
  if (ids && ids.length > 0) conditions.push(inArray(qrCodesTable.id, ids))

  const rows = await db
    .select({ qr: qrCodesTable, design: qrStylesTable.design })
    .from(qrCodesTable)
    .leftJoin(qrStylesTable, eq(qrStylesTable.qrCodeId, qrCodesTable.id))
    .where(and(...conditions))
    .orderBy(desc(qrCodesTable.createdAt))
    .limit(5000)

  return rows.map((row) => ({ ...row.qr, design: resolveDesign(row.design) }))
}

/** The public origin used to build short links (pass event.url.origin). */
export function getPublicOrigin(url: URL): string {
  return url.origin.replace(/\/+$/, "")
}
