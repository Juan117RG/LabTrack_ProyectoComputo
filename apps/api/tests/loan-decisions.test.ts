import "./setup.js";
import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import pool from "../src/db.ts";
import loansService from "../src/services/loans.service.ts";
import { assertErrorResponse } from "./setup.js";

const originalConnect = Object.getOwnPropertyDescriptor(pool, "connect");
const originalQuery = Object.getOwnPropertyDescriptor(pool, "query");
afterEach(() => {
  if (originalConnect) Object.defineProperty(pool, "connect", originalConnect);
  else delete (pool as any).connect;
  if (originalQuery) Object.defineProperty(pool, "query", originalQuery);
  else delete (pool as any).query;
});

// Simula el bloqueo de PostgreSQL; estas pruebas no sustituyen una prueba con la base real.
function database(failUpdate = false) {
  let loan = { id: 1, user_id: 1, equipment_id: 3, status: "pending" };
  let equipment = { id: 3, status: "available" };
  let tail = Promise.resolve();
  let releases = 0;
  const statements: string[] = [];
  Object.defineProperty(pool, "query", {
    configurable: true,
    value: async (sql: string) => {
      // Una lectura fuera de la transacción obtiene una copia que puede quedar obsoleta.
      return {
        rows: sql.includes("FROM loans") ? [{ ...loan }] : [{ ...equipment }],
      };
    },
  });
  Object.defineProperty(pool, "connect", {
    configurable: true,
    value: async () => {
      let unlock: (() => void) | undefined;
      let snapshot:
        | { loan: typeof loan; equipment: typeof equipment }
        | undefined;
      return {
        release() {
          releases++;
          unlock?.();
        },
        async query(raw: string) {
          const sql = raw.trim();
          statements.push(sql);
          if (/FROM loans.*FOR UPDATE/s.test(sql)) {
            const previous = tail;
            tail = new Promise<void>((resolve) => {
              unlock = resolve;
            });
            await previous;
            snapshot = { loan: { ...loan }, equipment: { ...equipment } };
            return { rows: [{ ...loan }] };
          }
          if (/FROM equipment/.test(sql)) return { rows: [{ ...equipment }] };
          if (/^UPDATE loans/.test(sql)) {
            if (failUpdate) throw new Error("Simulated write failure");
            loan.status = sql.includes("'rejected'") ? "rejected" : "approved";
            return { rows: [{ ...loan }] };
          }
          if (/^UPDATE equipment/.test(sql)) {
            equipment.status = "unavailable";
            return { rows: [{ ...equipment }] };
          }
          if (sql === "ROLLBACK" && snapshot) {
            loan = snapshot.loan;
            equipment = snapshot.equipment;
          }
          return { rows: [] };
        },
      };
    },
  });
  return {
    loan: () => loan,
    equipment: () => equipment,
    statements,
    releases: () => releases,
  };
}

for (const first of ["approve", "reject"] as const) {
  test(`concurrent decisions preserve ${first} and reject the second decision`, async () => {
    const db = database();
    const operations =
      first === "approve"
        ? [loansService.approveLoan("1"), loansService.rejectLoan("1")]
        : [loansService.rejectLoan("1"), loansService.approveLoan("1")];
    const result = await Promise.allSettled(operations);
    assert.equal(result[0].status, "fulfilled");
    assert.equal(result[1].status, "rejected");
    assert.equal(
      db.loan().status,
      first === "approve" ? "approved" : "rejected",
    );
    assert.equal(
      db.equipment().status,
      first === "approve" ? "unavailable" : "available",
    );
    assert.equal(
      db.statements.filter((sql) => /^UPDATE loans/.test(sql)).length,
      1,
    );
    assert.equal(db.statements.filter((sql) => sql === "COMMIT").length, 1);
    assert.equal(db.statements.filter((sql) => sql === "ROLLBACK").length, 1);
    assert.equal(db.releases(), 2);
  });
}

test("rejection rolls back and releases its connection when writing fails", async () => {
  const db = database(true);
  await assert.rejects(loansService.rejectLoan("1"), /Simulated write failure/);
  assert.equal(db.loan().status, "pending");
  assert.equal(db.equipment().status, "available");
  assert.ok(db.statements.includes("ROLLBACK"));
  assert.ok(!db.statements.includes("COMMIT"));
  assert.equal(db.releases(), 1);
});

test("error assertions reject incorrect status, code, message and missing success flag", () => {
  const valid = {
    status: 403,
    body: {
      success: false,
      message: "Forbidden",
      error: { code: "FORBIDDEN" },
    },
  };
  const expected = { status: 403, code: "FORBIDDEN", message: "Forbidden" };
  assert.doesNotThrow(() => assertErrorResponse(valid, expected));
  assert.throws(() => assertErrorResponse({ ...valid, status: 500 }, expected));
  assert.throws(() =>
    assertErrorResponse(
      { ...valid, body: { ...valid.body, error: { code: "INTERNAL" } } },
      expected,
    ),
  );
  assert.throws(() =>
    assertErrorResponse(
      { ...valid, body: { ...valid.body, message: "Wrong" } },
      expected,
    ),
  );
  assert.throws(() => assertErrorResponse({ status: 403, body: {} }, expected));
});
