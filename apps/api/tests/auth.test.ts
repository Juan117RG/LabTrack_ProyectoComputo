import "./setup.js";
import { assertErrorResponse } from "./setup.js";
import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import request from "supertest";
import app from "../src/app.ts";
import pool from "../src/db.ts";
import { generateAccessToken, generateRefreshToken } from "../src/utils/jwt.js";
import { hashPassword } from "../src/utils/password.js";

process.env.JWT_SECRET ??= "test-key-".repeat(8);

const originalQueryDescriptor = Object.getOwnPropertyDescriptor(pool, "query");

afterEach(() => {
  if (originalQueryDescriptor) {
    Object.defineProperty(pool, "query", originalQueryDescriptor);
  }
});

type MockResult = unknown[] | { rows: unknown[] };
type MockHandler = (
  sql: string,
  params: any[],
) => MockResult | Promise<MockResult>;

type QueryRecord = [sql: string, params: any[]];

function mockDatabase(mock: unknown[] | MockHandler): QueryRecord[] {
  const queries: QueryRecord[] = [];

  Object.defineProperty(pool, "query", {
    configurable: true,
    value: async (...args: unknown[]) => {
      const sql = String(args[0] ?? "");
      const params = Array.isArray(args[1]) ? (args[1] as any[]) : [];
      queries.push([sql, params]);

      if (typeof mock === "function") {
        const result = await mock(sql, params);
        if (Array.isArray(result)) {
          return { rows: result };
        }
        return result;
      }

      return { rows: mock };
    },
  });

  return queries;
}

test("POST /api/auth/register registers a new user successfully", async () => {
  const queries = mockDatabase((sql, params) => {
    // Check if user already exists
    if (/FROM users\s+WHERE email =/i.test(sql)) {
      return [];
    }
    // Insert new user
    if (/INSERT INTO users/i.test(sql)) {
      return [
        {
          id: 1,
          name: params[0],
          email: params[1],
          role: params[3],
        },
      ];
    }
    return [];
  });

  const response = await request(app).post("/api/auth/register").send({
    name: "Juan Perez",
    email: "juan@example.com",
    password: "password123",
    role: "student",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.name, "Juan Perez");
  assert.equal(response.body.data.email, "juan@example.com");
  assert.equal(response.body.data.role, "student");
  assert.equal(response.body.data.password_hash, undefined);

  assert.equal(queries.length, 2);
  assert.match(queries[0]?.[0] ?? "", /FROM users/);
  assert.match(queries[1]?.[0] ?? "", /INSERT INTO users/);
});

test("POST /api/auth/register rejects when email already exists", async () => {
  const existingUser = {
    id: 1,
    name: "Existing",
    email: "exists@example.com",
    role: "student",
    password_hash: "hashed",
    active: true,
    token_version: 0,
  };

  const queries = mockDatabase((sql) => {
    if (/FROM users\s+WHERE email =/i.test(sql)) {
      return [existingUser];
    }
    return [];
  });

  const response = await request(app).post("/api/auth/register").send({
    name: "Existing",
    email: "exists@example.com",
    password: "password123",
    role: "student",
  });

  assertErrorResponse(response, { status: 400, code: "EMAIL_ALREADY_EXISTS" });
  assert.equal(queries.length, 1);
});

test("POST /api/auth/register rejects invalid body data", async () => {
  const queries = mockDatabase([]);

  const response = await request(app).post("/api/auth/register").send({
    name: "",
    email: "not-an-email",
    password: "short",
    role: "superadmin",
  });

  assertErrorResponse(response, { status: 400, code: "VALIDATION_ERROR" });
  assert.equal(queries.length, 0);
});

test("POST /api/auth/login logs in user and sets HttpOnly refresh token cookie", async () => {
  const rawPassword = "securePassword123";
  const hashedPassword = await hashPassword(rawPassword);

  const user = {
    id: 1,
    name: "Juan Perez",
    email: "juan@example.com",
    role: "student",
    password_hash: hashedPassword,
    active: true,
    token_version: 0,
  };

  mockDatabase((sql) => {
    if (/FROM users\s+WHERE email =/i.test(sql)) {
      return [user];
    }
    return [];
  });

  const response = await request(app).post("/api/auth/login").send({
    email: "juan@example.com",
    password: rawPassword,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(typeof response.body.data.accessToken === "string");
  assert.equal(response.body.data.refreshToken, undefined);

  // Verify HttpOnly cookie header was set
  const cookies = response.headers["set-cookie"];
  assert.ok(cookies);
  const cookieHeader = Array.isArray(cookies) ? cookies.join(";") : cookies;
  assert.match(cookieHeader, /refreshToken=/);
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /Path=\/api\/auth/i);
});

test("POST /api/auth/login rejects when user is not found", async () => {
  mockDatabase([]);

  const response = await request(app).post("/api/auth/login").send({
    email: "nobody@example.com",
    password: "password123",
  });

  assertErrorResponse(response, { status: 401, code: "INVALID_CREDENTIALS" });
});

test("POST /api/auth/login rejects when password does not match", async () => {
  const hashedPassword = await hashPassword("correctPassword");

  const user = {
    id: 1,
    name: "Juan Perez",
    email: "juan@example.com",
    role: "student",
    password_hash: hashedPassword,
    active: true,
    token_version: 0,
  };

  mockDatabase((sql) => {
    if (/FROM users\s+WHERE email =/i.test(sql)) {
      return [user];
    }
    return [];
  });

  const response = await request(app).post("/api/auth/login").send({
    email: "juan@example.com",
    password: "wrongPassword",
  });

  assertErrorResponse(response, { status: 401, code: "INVALID_CREDENTIALS" });
});

test("POST /api/auth/refresh-token refreshes token via HttpOnly cookie", async () => {
  const user = {
    id: 1,
    name: "Juan Perez",
    email: "juan@example.com",
    role: "student" as const,
    active: true,
    token_version: 0,
  };

  const refreshToken = await generateRefreshToken({
    id: user.id,
    role: user.role,
    token_version: user.token_version,
  });

  mockDatabase((sql) => {
    if (/FROM users\s+WHERE id =/i.test(sql)) {
      return [user];
    }
    return [];
  });

  const response = await request(app)
    .post("/api/auth/refresh-token")
    .set("Cookie", [`refreshToken=${refreshToken}`]);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(typeof response.body.data.accessToken === "string");

  const cookies = response.headers["set-cookie"];
  assert.ok(cookies);
  const cookieHeader = Array.isArray(cookies) ? cookies.join(";") : cookies;
  assert.match(cookieHeader, /refreshToken=/);
  assert.match(cookieHeader, /HttpOnly/i);
});

test("POST /api/auth/refresh-token rejects a refresh token provided in the body", async () => {
  const user = {
    id: 2,
    name: "Manager User",
    email: "manager@example.com",
    role: "manager" as const,
    active: true,
    token_version: 0,
  };

  const refreshToken = await generateRefreshToken({
    id: user.id,
    role: user.role,
    token_version: user.token_version,
  });

  mockDatabase((sql) => {
    if (/FROM users\s+WHERE id =/i.test(sql)) {
      return [user];
    }
    return [];
  });

  const response = await request(app)
    .post("/api/auth/refresh-token")
    .send({ refreshToken });

  assertErrorResponse(response, { status: 400 });
});

test("POST /api/auth/refresh-token rejects when no token is provided", async () => {
  mockDatabase([]);

  const response = await request(app).post("/api/auth/refresh-token");

  assertErrorResponse(response, { status: 400, code: "TOKEN_REQUIRED" });
});

test("POST /api/auth/refresh-token rejects invalid/corrupted token", async () => {
  mockDatabase([]);

  const response = await request(app)
    .post("/api/auth/refresh-token")
    .set("Cookie", ["refreshToken=invalid-garbage-token"]);

  assertErrorResponse(response, { status: 401, code: "INVALID_REFRESH_TOKEN" });
});

test("POST /api/auth/refresh-token rejects when token has been revoked (token_version mismatch)", async () => {
  const user = {
    id: 1,
    name: "Juan Perez",
    email: "juan@example.com",
    role: "student" as const,
    active: true,
    token_version: 5, // DB token version is newer
  };

  const oldRefreshToken = await generateRefreshToken({
    id: user.id,
    role: user.role,
    token_version: 4, // Old token version
  });

  mockDatabase((sql) => {
    if (/FROM users\s+WHERE id =/i.test(sql)) {
      return [user];
    }
    return [];
  });

  const response = await request(app)
    .post("/api/auth/refresh-token")
    .set("Cookie", [`refreshToken=${oldRefreshToken}`]);

  assertErrorResponse(response, { status: 401, code: "TOKEN_REVOKED" });
});

test("POST /api/auth/logout logs out user, revokes token and clears cookie", async () => {
  const user = {
    id: 1,
    name: "Juan Perez",
    email: "juan@example.com",
    role: "student" as const,
    active: true,
    token_version: 1,
  };

  const accessToken = await generateAccessToken({
    id: user.id,
    role: user.role,
    token_version: user.token_version,
  });

  const refreshToken = await generateRefreshToken({
    id: user.id,
    role: user.role,
    token_version: user.token_version,
  });

  const queries = mockDatabase((sql) => {
    if (/FROM users\s+WHERE id =/i.test(sql)) {
      return [user];
    }
    if (/UPDATE users\s+SET token_version/i.test(sql)) {
      return [];
    }
    return [];
  });

  const response = await request(app)
    .post("/api/auth/logout")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Cookie", [`refreshToken=${refreshToken}`]);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  // Check DB incremented token version
  assert.ok(queries.some((q) => /UPDATE users/i.test(q[0])));

  // Verify cookie was cleared
  const cookies = response.headers["set-cookie"];
  assert.ok(cookies);
  const cookieHeader = Array.isArray(cookies) ? cookies.join(";") : cookies;
  assert.match(cookieHeader, /refreshToken=;/);
});

test("POST /api/auth/logout rejects when Bearer token is missing", async () => {
  mockDatabase([]);

  const response = await request(app).post("/api/auth/logout");

  assertErrorResponse(response, { status: 401, code: "TOKEN_REQUIRED" });
});

test("POST /api/auth/register rejects the manager role for public registration", async () => {
  const queries = mockDatabase([]);
  const response = await request(app).post("/api/auth/register").send({
    name: "Example Manager",
    email: "manager@example.com",
    password: "examplePassword123",
    role: "manager",
  });

  assertErrorResponse(response, { status: 400 });
  assert.equal(queries.length, 0);
});

test("POST /api/auth/refresh-token rejects access tokens", async () => {
  const token = await generateAccessToken({
    id: 1,
    role: "student",
    token_version: 0,
  });
  const queries = mockDatabase([]);
  const response = await request(app)
    .post("/api/auth/refresh-token")
    .set("Cookie", [`refreshToken=${token}`]);

  assertErrorResponse(response, { status: 401 });
  assert.equal(queries.length, 0);
});
