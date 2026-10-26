import {
  addDaysToIsoDate,
  boolValue,
  escapeVcardText,
  foldVcardLines,
  formatIsoDateValue,
  formatUtcDateTime,
  localDateTime,
  parseClockTime,
  parseIsoDate,
  textValue,
} from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

export interface EventPayloadInput {
  title: string
  location?: string
  description?: string
  startDate: string
  startTime?: string
  endDate?: string
  endTime?: string
  allDay?: boolean
}

/**
 * Build a bare VEVENT (RFC 5545) payload. Timed events are converted from the
 * user's wall clock time to UTC and encoded as YYYYMMDDTHHMMSSZ so the event
 * has no timezone ambiguity anywhere in the world. All-day events use
 * DATE values, with an exclusive DTEND (the day after the last day).
 */
export function buildEventPayload(input: EventPayloadInput): string {
  const title = input.title.trim()
  if (!title) throw new Error("An event title is required")
  const startDate = input.startDate.trim()
  if (!parseIsoDate(startDate)) throw new Error("A valid start date is required")

  const lines: string[] = ["BEGIN:VEVENT", "SUMMARY:" + escapeVcardText(title)]
  const location = (input.location ?? "").trim()
  if (location) lines.push("LOCATION:" + escapeVcardText(location))
  const description = (input.description ?? "").trim()
  if (description) lines.push("DESCRIPTION:" + escapeVcardText(description))

  if (input.allDay) {
    const startValue = formatIsoDateValue(startDate)
    if (!startValue) throw new Error("A valid start date is required")
    const endDateCandidate = (input.endDate ?? "").trim()
    const lastDay = parseIsoDate(endDateCandidate) ? endDateCandidate : startDate
    const exclusiveEnd = addDaysToIsoDate(lastDay, 1)
    if (!exclusiveEnd) throw new Error("A valid end date is required")
    const endValue = formatIsoDateValue(exclusiveEnd)
    lines.push("DTSTART;VALUE=DATE:" + startValue)
    lines.push("DTEND;VALUE=DATE:" + (endValue ?? startValue))
    lines.push("END:VEVENT")
    return foldVcardLines(lines)
  }

  const startTime = (input.startTime ?? "09:00").trim()
  if (!parseClockTime(startTime)) throw new Error("A valid start time is required")
  const start = localDateTime(startDate, startTime)
  if (!start) throw new Error("A valid start date and time are required")

  const endDateCandidate = (input.endDate ?? "").trim()
  const endTimeCandidate = (input.endTime ?? "").trim()
  let end: Date | null = null
  if (parseIsoDate(endDateCandidate)) {
    end = localDateTime(
      endDateCandidate,
      parseClockTime(endTimeCandidate) ? endTimeCandidate : startTime,
    )
  } else if (parseClockTime(endTimeCandidate)) {
    end = localDateTime(startDate, endTimeCandidate)
  }
  if (!end) end = new Date(start.getTime() + 60 * 60 * 1000)
  if (end.getTime() <= start.getTime()) throw new Error("The end must be after the start")

  lines.push("DTSTART:" + formatUtcDateTime(start))
  lines.push("DTEND:" + formatUtcDateTime(end))
  lines.push("END:VEVENT")
  return foldVcardLines(lines)
}

/**
 * Calendar event payload. Bare VEVENT is the format used by QR generators and
 * understood by iOS Camera, Google Lens and ZXing based scanners.
 */
export const eventContentType: QrContentTypeDefinition = {
  id: "event",
  name: "Calendar Event",
  description: "Add a meeting or party to the visitor's calendar.",
  category: "event",
  icon: "calendar-days",
  supportsDynamic: false,
  fields: [
    {
      key: "title",
      label: "Event title",
      type: "text",
      placeholder: "Yopem Product Launch",
      required: true,
      maxLength: 200,
      fullWidth: true,
    },
    {
      key: "location",
      label: "Location",
      type: "text",
      placeholder: "Casablanca, Morocco",
      maxLength: 200,
      fullWidth: true,
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      placeholder: "What is happening?",
      rows: 3,
      maxLength: 500,
      fullWidth: true,
    },
    { key: "startDate", label: "Start date", type: "date", required: true },
    { key: "startTime", label: "Start time", type: "time", defaultValue: "09:00" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "endTime", label: "End time", type: "time" },
    {
      key: "allDay",
      label: "All-day event",
      type: "checkbox",
      defaultValue: false,
      help: "Dates only, no times.",
    },
  ],
  encode(values: ContentValues): string {
    return buildEventPayload({
      title: textValue(values, "title"),
      location: textValue(values, "location"),
      description: textValue(values, "description"),
      startDate: textValue(values, "startDate"),
      startTime: textValue(values, "startTime"),
      endDate: textValue(values, "endDate"),
      endTime: textValue(values, "endTime"),
      allDay: boolValue(values, "allDay"),
    })
  },
  validate(values: ContentValues) {
    const errors: Record<string, string> = {}
    const title = textValue(values, "title")
    if (!title) errors.title = "An event title is required"
    const startDate = textValue(values, "startDate")
    if (!parseIsoDate(startDate)) errors.startDate = "A valid start date is required"
    const allDay = boolValue(values, "allDay")
    if (!allDay) {
      const startTime = textValue(values, "startTime") || "09:00"
      if (!parseClockTime(startTime)) errors.startTime = "A valid start time is required"
      const endDate = textValue(values, "endDate")
      if (endDate && !parseIsoDate(endDate)) errors.endDate = "A valid end date is required"
      const endTime = textValue(values, "endTime")
      if (endTime && !parseClockTime(endTime)) errors.endTime = "A valid end time is required"
    } else if (textValue(values, "endDate") && !parseIsoDate(textValue(values, "endDate"))) {
      errors.endDate = "A valid end date is required"
    }
    return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true }
  },
  sample: {
    title: "Yopem Product Launch",
    location: "Casablanca, Morocco",
    description: "Join us for the launch of Yopem QR 2.0.",
    startDate: "2026-11-20",
    startTime: "18:00",
    endDate: "2026-11-20",
    endTime: "21:00",
    allDay: false,
  },
  summarize(values: ContentValues): string {
    const title = textValue(values, "title")
    const startDate = textValue(values, "startDate")
    return title ? title + (startDate ? " - " + startDate : "") : startDate
  },
}

export default eventContentType
