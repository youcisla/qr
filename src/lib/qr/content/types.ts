/**
 * Contracts for structured QR payloads ("content types").
 *
 * A content type owns its form schema, its validation and the exact string that
 * gets encoded into the QR code. The studio UI renders forms generically from
 * `fields`, and the scanner decodes payloads back into a friendly summary via
 * `src/lib/qr/parse.ts`.
 */

export type QrContentCategory =
  | "link"
  | "text"
  | "contact"
  | "message"
  | "wifi"
  | "event"
  | "payment"
  | "social"
  | "app"
  | "location"

export type ContentFieldType =
  | "text"
  | "url"
  | "email"
  | "tel"
  | "number"
  | "textarea"
  | "select"
  | "date"
  | "time"
  | "checkbox"

export interface ContentFieldOption {
  label: string
  value: string
}

export interface ContentField {
  key: string
  label: string
  type: ContentFieldType
  placeholder?: string
  help?: string
  required?: boolean
  defaultValue?: string | boolean
  options?: ContentFieldOption[]
  maxLength?: number
  rows?: number
  /** Render this field on its own row (useful for textareas). */
  fullWidth?: boolean
  /** Only show when another field equals one of the given values. */
  showIf?: { key: string; values: Array<string | boolean> }
}

/** Field values as produced by the form renderer. */
export type ContentValues = Record<string, string | boolean | undefined>

export interface ContentValidationResult {
  valid: boolean
  errors?: Record<string, string>
}

export interface QrContentTypeDefinition {
  /** Stable id persisted in `qr_codes.content_type`. */
  id: string
  name: string
  description: string
  category: QrContentCategory
  /** Lucide icon name (resolved by the UI icon map). */
  icon: string
  /** Whether the payload can be wrapped in a dynamic short link. */
  supportsDynamic: boolean
  fields: ContentField[]
  /** Encode form values into the exact QR payload. Throws on invalid input. */
  encode: (values: ContentValues) => string
  /** Optional validation with field-level errors. */
  validate?: (values: ContentValues) => ContentValidationResult
  /** Example values used by templates / previews. */
  sample: ContentValues
  /** Human readable payload summary used in lists and analytics. */
  summarize?: (values: ContentValues) => string
}

export function getFieldValue(values: ContentValues, key: string): string {
  const value = values[key]
  return typeof value === "string" ? value.trim() : ""
}

export function getBoolValue(values: ContentValues, key: string): boolean {
  return values[key] === true || values[key] === "true"
}

export function defaultValuesFor(type: QrContentTypeDefinition): ContentValues {
  const values: ContentValues = {}
  for (const field of type.fields) {
    if (field.defaultValue !== undefined) values[field.key] = field.defaultValue
    else values[field.key] = field.type === "checkbox" ? false : ""
  }
  return values
}

export function withDefaults(
  type: QrContentTypeDefinition,
  values?: ContentValues | null,
): ContentValues {
  return { ...defaultValuesFor(type), ...(values ?? {}) }
}
