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

// Un error interno no debe pasar por una respuesta de validación o de permisos.
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
  assert.equal(response.body?.success, false);

  if (expected.status !== undefined) {
    assert.equal(response.status, expected.status);
  }

  const actualCode = response.body?.error?.code;
  if (expected.code !== undefined) {
    assert.equal(actualCode, expected.code);
  }

  const actualMessage = response.body?.message ?? response.body?.error?.message;
  if (expected.message !== undefined) {
    assert.equal(actualMessage, expected.message);
  }
}
