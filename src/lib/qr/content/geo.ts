import { textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

const COORDINATE_PATTERN = /^[+-]?\d{1,3}(\.\d{1,12})?$/

function readCoordinate(value: string): number | null {
  if (!COORDINATE_PATTERN.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * geo: URI. The label (when present) travels as the q= parameter so scanner
 * apps can show a human readable place name next to the coordinates.
 */
export const geoContentType: QrContentTypeDefinition = {
  id: "geo",
  name: "Location",
  description: "Send people to a precise set of coordinates on their map app.",
  category: "location",
  icon: "map-pin",
  supportsDynamic: false,
  fields: [
    {
      key: "latitude",
      label: "Latitude",
      type: "number",
      placeholder: "48.8566",
      help: "Decimal degrees between -90 and 90.",
      required: true,
    },
    {
      key: "longitude",
      label: "Longitude",
      type: "number",
      placeholder: "2.3522",
      help: "Decimal degrees between -180 and 180.",
      required: true,
    },
    {
      key: "label",
      label: "Place name",
      type: "text",
      placeholder: "Yopem HQ, Paris",
      help: "Optional. Shown by map apps next to the pin.",
      maxLength: 120,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const latitude = textValue(values, "latitude").replace(/^\+/, "")
    const longitude = textValue(values, "longitude").replace(/^\+/, "")
    const latitudeNumber = readCoordinate(latitude)
    const longitudeNumber = readCoordinate(longitude)
    if (latitudeNumber === null || latitudeNumber < -90 || latitudeNumber > 90) {
      throw new Error("Latitude must be a number between -90 and 90")
    }
    if (longitudeNumber === null || longitudeNumber < -180 || longitudeNumber > 180) {
      throw new Error("Longitude must be a number between -180 and 180")
    }

    const coordinates = "geo:" + String(latitudeNumber) + "," + String(longitudeNumber)
    const label = textValue(values, "label")
    return label ? coordinates + "?q=" + encodeURIComponent(label) : coordinates
  },
  validate(values: ContentValues) {
    const errors: Record<string, string> = {}
    const latitude = textValue(values, "latitude")
    const longitude = textValue(values, "longitude")
    const latitudeNumber = readCoordinate(latitude.replace(/^\+/, ""))
    const longitudeNumber = readCoordinate(longitude.replace(/^\+/, ""))
    if (latitudeNumber === null || latitudeNumber < -90 || latitudeNumber > 90) {
      errors.latitude = "Latitude must be a number between -90 and 90"
    }
    if (longitudeNumber === null || longitudeNumber < -180 || longitudeNumber > 180) {
      errors.longitude = "Longitude must be a number between -180 and 180"
    }
    return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true }
  },
  sample: { latitude: "48.8566", longitude: "2.3522", label: "Yopem HQ, Paris" },
  summarize(values: ContentValues): string {
    const label = textValue(values, "label")
    const coordinates = textValue(values, "latitude") + ", " + textValue(values, "longitude")
    return label ? label + " (" + coordinates + ")" : coordinates
  },
}

export default geoContentType
