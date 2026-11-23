import "./setup.js";
import { assertErrorResponse } from "./setup.js";
import { strict as assert } from "node:assert";
import { afterEach, before, test } from "node:test";
import request from "supertest";
import app from "../src/app.ts";
import pool from "../src/db.ts";
import { generateAccessToken } from "../src/utils/jwt.js";

const originalQueryDescriptor = Object.getOwnPropertyDescriptor(pool, "query");

afterEach(() => {
  if (originalQueryDescriptor) {
    Object.defineProperty(pool, "query", originalQueryDescriptor);
  }
});

const studentUser = {
  id: 1,
  name: "Student User",
  email: "student@example.com",
  role: "student" as const,
  active: true,
  token_version: 0,
};

const managerUser = {
  id: 99,
  name: "Manager User",
  email: "manager@example.com",
  role: "manager" as const,
  active: true,
  token_version: 0,
};

let studentToken: string;
let managerToken: string;

before(async () => {
  studentToken = await generateAccessToken({
    id: studentUser.id,
    role: studentUser.role,
    token_version: studentUser.token_version,
  });
  managerToken = await generateAccessToken({
    id: managerUser.id,
    role: managerUser.role,
    token_version: managerUser.token_version,
  });
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

      // Always handle authMiddleware user lookups
      if (/FROM users\s+WHERE id =/i.test(sql)) {
        const userId = Number(params[0]);
        if (userId === managerUser.id) {
          return { rows: [managerUser] };
        }
        return { rows: [studentUser] };
      }

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

test("GET /api/equipment returns all equipment without a filter for authenticated student", async () => {
  const equipment = [
    {
      id: 1,
      name: "Microscopio",
      description: "Equipo óptico",
      status: "available",
    },
  ];
  const queries = mockDatabase(equipment);

  const response = await request(app)
    .get("/api/equipment")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, equipment);
  const equipQuery = queries.find((q) => /FROM equipment/i.test(q[0]));
  assert.ok(equipQuery);
  assert.doesNotMatch(equipQuery[0], /WHERE status/);
});

test("GET /api/equipment filters by status", async () => {
  const equipment = [
    {
      id: 2,
      name: "Multímetro",
      description: "Instrumento de medición",
      status: "unavailable",
    },
  ];
  const queries = mockDatabase(equipment);

  const response = await request(app)
    .get("/api/equipment")
    .set("Authorization", `Bearer ${studentToken}`)
    .query({ status: "unavailable" });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, equipment);
  const equipQuery = queries.find((q) => /FROM equipment/i.test(q[0]));
  assert.ok(equipQuery);
  assert.match(equipQuery[0], /WHERE status = \$1/);
  assert.deepEqual(equipQuery[1], ["unavailable"]);
});

test("GET /api/equipment rejects an unsupported status", async () => {
  mockDatabase([]);

  const response = await request(app)
    .get("/api/equipment")
    .set("Authorization", `Bearer ${studentToken}`)
    .query({ status: "broken" });

  assertErrorResponse(response, { status: 400, code: "VALIDATION_ERROR" });
});

test("GET /api/equipment rejects unauthenticated requests", async () => {
  mockDatabase([]);

  const response = await request(app).get("/api/equipment");

  assertErrorResponse(response, { status: 401, code: "TOKEN_REQUIRED" });
});

test("POST /api/equipment creates equipment with validated data for manager", async () => {
  const equipment = {
    id: 3,
    name: "Osciloscopio",
    description: "Equipo de laboratorio",
    status: "available",
  };
  const queries = mockDatabase([equipment]);

  const response = await request(app)
    .post("/api/equipment")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({
      name: equipment.name,
      description: equipment.description,
    });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, equipment);
  const insertQuery = queries.find((q) => /INSERT INTO equipment/i.test(q[0]));
  assert.ok(insertQuery);
  assert.deepEqual(insertQuery[1], [
    equipment.name,
    equipment.description,
    "available",
  ]);
});

test("POST /api/equipment rejects student role with 403", async () => {
  mockDatabase([]);

  const response = await request(app)
    .post("/api/equipment")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({
      name: "Osciloscopio",
      description: "Equipo de laboratorio",
    });

  assertErrorResponse(response, {
    status: 403,
    code: "NOT_SUFFICIENT_PERMISSIONS",
  });
});
