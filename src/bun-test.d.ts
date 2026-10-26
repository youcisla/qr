/**
 * Minimal ambient typings for Bun's built-in test runner.
 *
 * Bun executes these tests with `bun test`; svelte-check only needs enough
 * surface to type-check the test files without pulling in @types/bun.
 */
declare module "bun:test" {
  export interface Matchers {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toBeCloseTo(expected: number, precision?: number): void
    toBeGreaterThan(expected: number): void
    toBeGreaterThanOrEqual(expected: number): void
    toBeLessThan(expected: number): void
    toBeLessThanOrEqual(expected: number): void
    toBeTruthy(): void
    toBeFalsy(): void
    toBeNull(): void
    toBeUndefined(): void
    toBeDefined(): void
    toBeInstanceOf(expected: unknown): void
    toContain(expected: unknown): void
    toContainEqual(expected: unknown): void
    toMatch(expected: string | RegExp): void
    toHaveLength(expected: number): void
    toHaveProperty(path: string, value?: unknown): void
    toMatchObject(expected: Record<string, unknown>): void
    toThrow(expected?: string | RegExp | Error): void
    toStartWith(expected: string): void
    toEndWith(expected: string): void
    not: Matchers
    resolves: Matchers
    rejects: Matchers
  }
  export function expect(value: unknown): Matchers
  export function describe(name: string, fn: () => void): void
  export function test(name: string, fn: () => void | Promise<void>): void
  export function it(name: string, fn: () => void | Promise<void>): void
  export function beforeAll(fn: () => void | Promise<void>): void
  export function afterAll(fn: () => void | Promise<void>): void
  export function beforeEach(fn: () => void | Promise<void>): void
  export function afterEach(fn: () => void | Promise<void>): void
}
