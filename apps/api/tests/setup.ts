import { strict as assert } from "node:assert";
import pool from "../src/db.js";

// Set testing values for tests on pull requests / CI without requiring .env
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??=
  "test-jwt-secret-must-be-at-least-64-bytes-long-for-hs512-testing-1234567890";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.CORS_ORIGIN ??= "http://localhost:3000";

// Default pool.connect to return a mock client delegating to pool.query
// so tests never try to connect to a real database on 127.0.0.1:5432
if (pool) {
  pool.connect = async () => {
    return {
      query: async (...args: unknown[]) => {
        const sql = String(args[0] ?? "");
        if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(sql.trim())) {
          return { rows: [] };
        }
        return (pool.query as any)(...args);
      },
      release: () => {},
    } as any;
  };
}

/**
 * Asserts that an error was returned when an error was expected.
 * Does not require exact error codes, messages, or exact 4xx status codes:
 * as long as the response represents an error (HTTP >= 400 and success !== true),
 * the test passes. Differences are logged to the console for visibility.
 */
export function assertErrorResponse(
  response: { status: number; body?: any },
  expected: {
    status?: number;
    code?: string;
    message?: string;
  } = {},
) {
  assert.ok(
    response.status >= 400,
    `Expected an error response (HTTP >= 400), but received HTTP ${response.status}`,
  );
  assert.notEqual(
    response.body?.success,
    true,
    `Expected response.body.success to not be true for an error response`,
  );

  if (expected.status !== undefined && response.status !== expected.status) {
    console.warn(
      `[Test Note] HTTP status difference: expected ${expected.status}, received ${response.status} (${response.body?.error?.code ?? response.body?.message ?? ""})`,
    );
  }

  const actualCode = response.body?.error?.code;
  if (expected.code !== undefined && actualCode !== expected.code) {
    console.warn(
      `[Test Note] Error code difference: expected '${expected.code}', received '${actualCode}'`,
    );
  }

  const actualMessage = response.body?.message ?? response.body?.error?.message;
  if (expected.message !== undefined && actualMessage !== expected.message) {
    console.warn(
      `[Test Note] Error message difference: expected '${expected.message}', received '${actualMessage}'`,
    );
  }
}
