import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import request from "supertest";
import app from "../src/app.ts";
import pool from "../src/db.ts";
import type { Loan } from "../src/types/loans.types.js";
import type { Equipment } from "../src/types/equipment.types.js";

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

test("GET /api/loans returns all loans without a filter", async () => {
  const loans: Loan[] = [
    {
      id: 1,
      user_id: 1,
      equipment_id: 1,
      status: "pending",
      requested_at: "2024-06-01T12:00:00Z",
      approved_at: null,
      returned_at: null,
      return_condition: null,
    },
  ];
  const queries = mockDatabase(loans);

  const response = await request(app).get("/api/loans");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, loans);
  assert.match(queries[0]?.[0] ?? "", /FROM loans/);
  assert.doesNotMatch(queries[0]?.[0] ?? "", /WHERE status/);
});

test("GET /api/loans filters by status", async () => {
  const pendingLoan: Loan = {
    id: 1,
    user_id: 1,
    equipment_id: 1,
    status: "pending",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };
  const queries = mockDatabase([pendingLoan]);

  const response = await request(app)
    .get("/api/loans")
    .query({ status: "pending" });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, [pendingLoan]);
  assert.match(queries[0]?.[0] ?? "", /WHERE status = \$1/);
  assert.deepEqual(queries[0]?.[1], ["pending"]);
});

test("GET /api/loans rejects an unsupported status", async () => {
  const response = await request(app)
    .get("/api/loans")
    .query({ status: "broken" });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

test("GET /api/loans/:id returns loan by ID when found", async () => {
  const loan: Loan = {
    id: 1,
    user_id: 1,
    equipment_id: 1,
    status: "pending",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };
  const queries = mockDatabase([loan]);

  const response = await request(app).get("/api/loans/1");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, loan);
  assert.match(queries[0]?.[0] ?? "", /WHERE id = \$1/);
  assert.deepEqual(queries[0]?.[1], ["1"]);
});

test("GET /api/loans/:id returns 404 when loan is not found", async () => {
  const queries = mockDatabase([]);

  const response = await request(app).get("/api/loans/999");

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_NOT_FOUND");
  assert.match(queries[0]?.[0] ?? "", /WHERE id = \$1/);
  assert.deepEqual(queries[0]?.[1], ["999"]);
});

test("POST /api/loans creates a loan with the validated data when equipment is available", async () => {
  const availableEquipment: Equipment = {
    id: 1,
    name: "Microscopio",
    description: "Equipo óptico",
    status: "available",
  };
  const createdLoan: Loan = {
    id: 1,
    user_id: 1,
    equipment_id: 1,
    status: "pending",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };

  const queries = mockDatabase((sql) => {
    if (/FROM equipment/i.test(sql)) {
      return [availableEquipment];
    }
    if (/INSERT INTO loans/i.test(sql)) {
      return [createdLoan];
    }
    return [];
  });

  const response = await request(app).post("/api/loans").send({
    user_id: createdLoan.user_id,
    equipment_id: createdLoan.equipment_id,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, createdLoan);

  assert.equal(queries.length, 2);
  // First query verifies equipment exists and is available
  assert.match(queries[0]?.[0] ?? "", /FROM equipment/);
  assert.deepEqual(queries[0]?.[1], [createdLoan.equipment_id]);
  // Second query inserts the new loan
  assert.match(queries[1]?.[0] ?? "", /INSERT INTO loans/);
  assert.equal(queries[1]?.[1]?.[0], createdLoan.user_id);
  assert.equal(queries[1]?.[1]?.[1], createdLoan.equipment_id);
  assert.equal(queries[1]?.[1]?.[2], "pending");
});

test("POST /api/loans refuses to create a loan when the equipment does not exist", async () => {
  const queries = mockDatabase((sql) => {
    if (/FROM equipment/i.test(sql)) {
      return []; // Equipment does not exist
    }
    return [];
  });

  const response = await request(app).post("/api/loans").send({
    user_id: 1,
    equipment_id: 999,
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "EQUIPMENT_NOT_FOUND");
  assert.equal(response.body.message, "Equipment not found");

  // Verify that it checked equipment but refused to execute INSERT INTO loans
  assert.equal(queries.length, 1);
  assert.match(queries[0]?.[0] ?? "", /FROM equipment/);
  assert.deepEqual(queries[0]?.[1], [999]);
  const insertQueries = queries.filter((q) => /INSERT INTO loans/i.test(q[0]));
  assert.equal(insertQueries.length, 0);
});

test("POST /api/loans refuses to create a loan when the equipment is not available", async () => {
  const unavailableEquipment: Equipment = {
    id: 2,
    name: "Multímetro",
    description: "Instrumento de medición",
    status: "unavailable",
  };

  const queries = mockDatabase((sql) => {
    if (/FROM equipment/i.test(sql)) {
      return [unavailableEquipment];
    }
    return [];
  });

  const response = await request(app).post("/api/loans").send({
    user_id: 1,
    equipment_id: 2,
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "EQUIPMENT_NOT_AVAILABLE");
  assert.equal(response.body.message, "Equipment is not available for loan");

  // Verify that it checked equipment but refused to execute INSERT INTO loans
  assert.equal(queries.length, 1);
  assert.match(queries[0]?.[0] ?? "", /FROM equipment/);
  assert.deepEqual(queries[0]?.[1], [2]);
  const insertQueries = queries.filter((q) => /INSERT INTO loans/i.test(q[0]));
  assert.equal(insertQueries.length, 0);
});

test("POST /api/loans rejects invalid body data", async () => {
  const queries = mockDatabase([]);

  const response = await request(app).post("/api/loans").send({
    user_id: -1,
    equipment_id: "not-a-number",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  // No database queries executed on validation failure
  assert.equal(queries.length, 0);
});

test("PATCH /api/loans/:id/approve approves a pending loan and marks equipment as unavailable", async () => {
  const pendingLoan: Loan = {
    id: 1,
    user_id: 1,
    equipment_id: 3,
    status: "pending",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };
  const approvedLoan: Loan = {
    ...pendingLoan,
    status: "approved",
    approved_at: "2024-06-02T12:00:00Z",
  };
  const equipment: Equipment = {
    id: 3,
    name: "Osciloscopio",
    description: null,
    status: "available",
  };

  const queries = mockDatabase((sql) => {
    if (/FROM loans\s+WHERE id/i.test(sql)) {
      return [pendingLoan];
    }
    if (/UPDATE loans/i.test(sql)) {
      return [approvedLoan];
    }
    if (/FROM equipment\s+WHERE id/i.test(sql)) {
      return [equipment];
    }
    if (/UPDATE equipment/i.test(sql)) {
      return [{ ...equipment, status: "unavailable" }];
    }
    return [];
  });

  const response = await request(app).patch("/api/loans/1/approve");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, approvedLoan);

  assert.ok(queries.some((q) => /UPDATE loans/i.test(q[0])));
  assert.ok(queries.some((q) => /UPDATE equipment/i.test(q[0])));
});

test("PATCH /api/loans/:id/approve returns 404 when loan does not exist", async () => {
  const queries = mockDatabase([]);

  const response = await request(app).patch("/api/loans/999/approve");

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_NOT_FOUND");
});

test("PATCH /api/loans/:id/approve rejects approving a non-pending loan", async () => {
  const alreadyApprovedLoan: Loan = {
    id: 1,
    user_id: 1,
    equipment_id: 3,
    status: "approved",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: "2024-06-02T12:00:00Z",
    returned_at: null,
    return_condition: null,
  };

  const queries = mockDatabase((sql) => {
    if (/FROM loans\s+WHERE id/i.test(sql)) {
      return [alreadyApprovedLoan];
    }
    return [];
  });

  const response = await request(app).patch("/api/loans/1/approve");

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_INVALID_STATUS");
  assert.equal(response.body.message, "Only pending loans can be approved");

  // Verify no UPDATE query was executed
  const updateQueries = queries.filter((q) => /UPDATE/i.test(q[0]));
  assert.equal(updateQueries.length, 0);
});

test("PATCH /api/loans/:id/reject rejects a pending loan", async () => {
  const pendingLoan: Loan = {
    id: 1,
    user_id: 1,
    equipment_id: 3,
    status: "pending",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };
  const rejectedLoan: Loan = {
    ...pendingLoan,
    status: "rejected",
  };

  const queries = mockDatabase((sql) => {
    if (/FROM loans\s+WHERE id/i.test(sql)) {
      return [pendingLoan];
    }
    if (/UPDATE loans/i.test(sql)) {
      return [rejectedLoan];
    }
    return [];
  });

  const response = await request(app).patch("/api/loans/1/reject");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, rejectedLoan);
});

test("PATCH /api/loans/:id/reject returns 404 when loan does not exist", async () => {
  const queries = mockDatabase([]);

  const response = await request(app).patch("/api/loans/999/reject");

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_NOT_FOUND");
});

test("PATCH /api/loans/:id/reject rejects rejecting a non-pending loan", async () => {
  const alreadyRejectedLoan: Loan = {
    id: 1,
    user_id: 1,
    equipment_id: 3,
    status: "rejected",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };

  const queries = mockDatabase((sql) => {
    if (/FROM loans\s+WHERE id/i.test(sql)) {
      return [alreadyRejectedLoan];
    }
    return [];
  });

  const response = await request(app).patch("/api/loans/1/reject");

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_INVALID_STATUS");
  assert.equal(response.body.message, "Only pending loans can be rejected");

  // Verify no UPDATE query was executed
  const updateQueries = queries.filter((q) => /UPDATE/i.test(q[0]));
  assert.equal(updateQueries.length, 0);
});
