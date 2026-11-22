import "./setup.js";
import { strict as assert } from "node:assert";
import { afterEach, before, test } from "node:test";
import request from "supertest";
import app from "../src/app.ts";
import pool from "../src/db.ts";
import { generateAccessToken } from "../src/utils/jwt.js";

const queryDescriptor = Object.getOwnPropertyDescriptor(pool, "query");
const connectDescriptor = Object.getOwnPropertyDescriptor(pool, "connect");
const tokens: Record<string, string> = {};
before(async () => {
  for (const role of ["student", "manager", "admin"]) {
    tokens[role] = await generateAccessToken({ id: 1, role, token_version: 0 });
  }
});
afterEach(() => {
  if (queryDescriptor) Object.defineProperty(pool, "query", queryDescriptor);
  else delete (pool as any).query;
  if (connectDescriptor)
    Object.defineProperty(pool, "connect", connectDescriptor);
  else delete (pool as any).connect;
});
function database(role = "manager", status = "approved", fail = false) {
  const statements: string[] = [];
  let released = false;
  Object.defineProperty(pool, "query", {
    configurable: true,
    value: async () => ({
      rows: [{ id: 1, role, active: true, token_version: 0 }],
    }),
  });
  Object.defineProperty(pool, "connect", {
    configurable: true,
    value: async () => ({
      release() {
        released = true;
      },
      async query(sql: string, params: unknown[] = []) {
        statements.push(sql);
        if (sql.startsWith("SELECT"))
          return {
            rows:
              status === "missing" ? [] : [{ id: 1, equipment_id: 3, status }],
          };
        if (sql.startsWith("UPDATE loans"))
          return {
            rows: [
              {
                id: 1,
                equipment_id: 3,
                status: "returned",
                returned_at: "2026-11-21T12:00:00Z",
                return_condition: params[1],
              },
            ],
          };
        if (sql.startsWith("UPDATE equipment")) {
          if (fail) throw new Error("Simulated database failure");
          return { rows: [{ id: 3 }] };
        }
        return { rows: [] };
      },
    }),
  });
  return { statements, released: () => released };
}
const endpoint = "/api/loans/1/return";
test("return saves reception details and availability in one transaction", async () => {
  const db = database();
  const res = await request(app)
    .patch(endpoint)
    .set("Authorization", `Bearer ${tokens.manager}`)
    .send({ return_condition: "  Completo  " });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "returned");
  assert.equal(res.body.data.return_condition, "Completo");
  assert.ok(res.body.data.returned_at);
  assert.match(db.statements[1], /FOR UPDATE/);
  assert.ok(
    db.statements.some((sql) =>
      /UPDATE equipment SET status = 'available'/.test(sql),
    ),
  );
  assert.equal(db.statements.at(-1), "COMMIT");
  assert.equal(db.released(), true);
});
test("return accepts an empty optional observation", async () => {
  database();
  const res = await request(app)
    .patch(endpoint)
    .set("Authorization", `Bearer ${tokens.manager}`)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.data.return_condition, null);
});
for (const status of ["pending", "rejected", "returned"]) {
  test(`return refuses ${status} loan without modifying records`, async () => {
    const db = database("manager", status);
    const res = await request(app)
      .patch(endpoint)
      .set("Authorization", `Bearer ${tokens.manager}`)
      .send({});
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "LOAN_INVALID_STATUS");
    assert.ok(!db.statements.some((sql) => sql.startsWith("UPDATE")));
    assert.equal(db.statements.at(-1), "ROLLBACK");
    assert.equal(db.released(), true);
  });
}
test("return rolls back when updating availability fails", async () => {
  const db = database("manager", "approved", true);
  const res = await request(app)
    .patch(endpoint)
    .set("Authorization", `Bearer ${tokens.manager}`)
    .send({});
  assert.equal(res.status, 500);
  assert.equal(db.statements.at(-1), "ROLLBACK");
  assert.ok(!db.statements.includes("COMMIT"));
  assert.equal(db.released(), true);
});
test("return missing loan returns 404", async () => {
  const db = database("manager", "missing");
  const res = await request(app)
    .patch(endpoint)
    .set("Authorization", `Bearer ${tokens.manager}`)
    .send({});
  assert.equal(res.status, 404);
  assert.equal(db.statements.at(-1), "ROLLBACK");
});
for (const role of ["student", "admin"]) {
  test(`return is forbidden for ${role}`, async () => {
    const db = database(role);
    const res = await request(app)
      .patch(endpoint)
      .set("Authorization", `Bearer ${tokens[role]}`)
      .send({});
    assert.equal(res.status, 403);
    assert.equal(db.statements.length, 0);
  });
}
test("return requires authentication", async () => {
  const db = database();
  const res = await request(app).patch(endpoint).send({});
  assert.equal(res.status, 401);
  assert.equal(db.statements.length, 0);
});
test("return validates identifier and observation before starting a transaction", async () => {
  const db = database();
  for (const [url, body] of [
    ["/api/loans/abc/return", {}],
    [endpoint, { return_condition: "x".repeat(1001) }],
    [endpoint, { return_condition: 42 }],
  ] as const) {
    const res = await request(app)
      .patch(url)
      .set("Authorization", `Bearer ${tokens.manager}`)
      .send(body);
    assert.equal(res.status, 400);
  }
  assert.equal(db.statements.length, 0);
});
