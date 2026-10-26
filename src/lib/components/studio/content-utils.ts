import {
  defaultValuesFor,
  encodeContent,
  validateContent,
  withDefaults,
  type ContentField,
  type ContentValues,
  type QrContentTypeDefinition,
} from "$lib/qr/content"

/** Whether a conditional field should be rendered for the current values. */
export function isFieldVisible(field: ContentField, values: ContentValues): boolean {
  if (!field.showIf) return true
  const current = values[field.showIf.key]
  return field.showIf.values.some((expected) => {
    if (typeof expected === "boolean") {
      return (current === true || current === "true") === expected
    }
    return String(current ?? "") === String(expected)
  })
}

/** Field errors from the codec registry (required, format and cross-field checks). */
export function collectErrors(
  type: QrContentTypeDefinition,
  values: ContentValues,
): Record<string, string> {
  const result = validateContent(type.id, values)
  return result.valid ? {} : (result.errors ?? {})
}

/** Encode the values, returning a field-friendly error instead of throwing. */
export function encodeValues(
  type: QrContentTypeDefinition,
  values: ContentValues,
): { data: string | null; error: string | null } {
  try {
    const data = encodeContent(type.id, values)
    return { data: typeof data === "string" && data.length > 0 ? data : null, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Invalid content" }
  }
}

/** A valid example payload used for gallery thumbnails and idle previews. */
export function sampleData(type: QrContentTypeDefinition): string | null {
  const values = withDefaults(type, type.sample ?? defaultValuesFor(type))
  return encodeValues(type, values).data
}

/** First error message, useful for a compact status line. */
export function firstError(errors: Record<string, string>): string | null {
  return Object.values(errors)[0] ?? null
}
