import { describe, expect, test } from "bun:test"

import {
  hashPassword,
  hasPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "./password"

describe("hashPassword", () => {
  test("produces a versioned scrypt hash with salt and key", async () => {
    const hash = await hashPassword("correct horse battery staple")
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
  })

  test("uses a fresh salt for every hash", async () => {
    const first = await hashPassword("same-password")
    const second = await hashPassword("same-password")
    expect(first).not.toBe(second)
  })
})

describe("verifyPassword", () => {
  test("accepts the correct password", async () => {
    const hash = await hashPassword("s3cret-pass")
    await expect(verifyPassword("s3cret-pass", hash)).resolves.toBe(true)
  })

  test("rejects a wrong password", async () => {
    const hash = await hashPassword("s3cret-pass")
    await expect(verifyPassword("s3cret-pas", hash)).resolves.toBe(false)
    await expect(verifyPassword("", hash)).resolves.toBe(false)
  })

  test("normalises unicode before hashing", async () => {
    const hash = await hashPassword("caf\u00e9")
    await expect(verifyPassword("cafe\u0301", hash)).resolves.toBe(true)
  })

  test("rejects missing or malformed stored hashes", async () => {
    await expect(verifyPassword("x", null)).resolves.toBe(false)
    await expect(verifyPassword("x", undefined)).resolves.toBe(false)
    await expect(verifyPassword("x", "")).resolves.toBe(false)
    await expect(verifyPassword("x", "plain-text")).resolves.toBe(false)
    await expect(verifyPassword("x", "scrypt$deadbeef$deadbeef")).resolves.toBe(false)
  })
})

describe("password limits", () => {
  test("exposes sane bounds", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(4)
    expect(MAX_PASSWORD_LENGTH).toBe(128)
  })

  test("hasPassword detects protection", () => {
    expect(hasPassword(null)).toBe(false)
    expect(hasPassword("")).toBe(false)
    expect(hasPassword("scrypt$aa$bb")).toBe(true)
  })
})
