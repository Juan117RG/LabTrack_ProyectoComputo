import "./setup.js";
import { strict as assert } from "node:assert";
import { afterEach, before, test } from "node:test";
import request from "supertest";
import app from "../src/app.ts";
import pool from "../src/db.ts";
import { generateAccessToken } from "../src/utils/jwt.js";
import type { Loan } from "../src/types/loans.types.js";
import type { Equipment } from "../src/types/equipment.types.js";

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

const otherStudentUser = {
  id: 2,
  name: "Other Student",
  email: "other@example.com",
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
let otherStudentToken: string;
let managerToken: string;

before(async () => {
  studentToken = await generateAccessToken({
    id: studentUser.id,
    role: studentUser.role,
    token_version: studentUser.token_version,
  });
  otherStudentToken = await generateAccessToken({
    id: otherStudentUser.id,
    role: otherStudentUser.role,
    token_version: otherStudentUser.token_version,
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

      // Automatically respond to authMiddleware user lookups
      if (/FROM users\s+WHERE id =/i.test(sql)) {
        const userId = Number(params[0]);
        if (userId === managerUser.id) {
          return { rows: [managerUser] };
        }
        if (userId === otherStudentUser.id) {
          return { rows: [otherStudentUser] };
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

test("GET /api/loans returns all loans for manager", async () => {
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

  const response = await request(app)
    .get("/api/loans")
    .set("Authorization", `Bearer ${managerToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, loans);
  const loanQuery = queries.find((q) => /FROM loans/i.test(q[0]));
  assert.ok(loanQuery);
  assert.doesNotMatch(loanQuery[0], /WHERE status/);
});

test("GET /api/loans rejects student role with 403", async () => {
  mockDatabase([]);

  const response = await request(app)
    .get("/api/loans")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "NOT_SUFFICIENT_PERMISSIONS");
});

test("GET /api/loans filters by status for manager", async () => {
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
    .set("Authorization", `Bearer ${managerToken}`)
    .query({ status: "pending" });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, [pendingLoan]);
  const loanQuery = queries.find((q) => /WHERE status = \$1/i.test(q[0]));
  assert.ok(loanQuery);
  assert.deepEqual(loanQuery[1], ["pending"]);
});

test("GET /api/loans rejects an unsupported status for manager", async () => {
  mockDatabase([]);

  const response = await request(app)
    .get("/api/loans")
    .set("Authorization", `Bearer ${managerToken}`)
    .query({ status: "broken" });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

test("GET /api/loans/myloans returns loans for current authenticated student", async () => {
  const myLoans: Loan[] = [
    {
      id: 1,
      user_id: studentUser.id,
      equipment_id: 1,
      status: "pending",
      requested_at: "2024-06-01T12:00:00Z",
      approved_at: null,
      returned_at: null,
      return_condition: null,
    },
  ];
  const queries = mockDatabase(myLoans);

  const response = await request(app)
    .get("/api/loans/myloans")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, myLoans);
  const userLoansQuery = queries.find((q) => /WHERE user_id = \$1/i.test(q[0]));
  assert.ok(userLoansQuery);
  assert.deepEqual(userLoansQuery[1], [studentUser.id]);
});

test("GET /api/loans/user/:userId returns loans for specified user when called by manager", async () => {
  const userLoans: Loan[] = [
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
  const queries = mockDatabase(userLoans);

  const response = await request(app)
    .get("/api/loans/user/1")
    .set("Authorization", `Bearer ${managerToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, userLoans);
  const userLoansQuery = queries.find((q) => /WHERE user_id = \$1/i.test(q[0]));
  assert.ok(userLoansQuery);
  assert.deepEqual(userLoansQuery[1], [1]);
});

test("GET /api/loans/user/:userId rejects student role with 403", async () => {
  mockDatabase([]);

  const response = await request(app)
    .get("/api/loans/user/1")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "NOT_SUFFICIENT_PERMISSIONS");
});

test("GET /api/loans/:id returns loan by ID when student owns the loan", async () => {
  const loan: Loan = {
    id: 1,
    user_id: studentUser.id,
    equipment_id: 1,
    status: "pending",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };
  mockDatabase([loan]);

  const response = await request(app)
    .get("/api/loans/1")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, loan);
});

test("GET /api/loans/:id forbids student from viewing another student loan", async () => {
  const loan: Loan = {
    id: 1,
    user_id: otherStudentUser.id, // belongs to user 2
    equipment_id: 1,
    status: "pending",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };
  mockDatabase([loan]);

  const response = await request(app)
    .get("/api/loans/1")
    .set("Authorization", `Bearer ${studentToken}`); // user 1

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_VIEW_FORBIDDEN");
});

test("GET /api/loans/:id allows manager to view any loan", async () => {
  const loan: Loan = {
    id: 1,
    user_id: otherStudentUser.id,
    equipment_id: 1,
    status: "pending",
    requested_at: "2024-06-01T12:00:00Z",
    approved_at: null,
    returned_at: null,
    return_condition: null,
  };
  mockDatabase([loan]);

  const response = await request(app)
    .get("/api/loans/1")
    .set("Authorization", `Bearer ${managerToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, loan);
});

test("GET /api/loans/:id returns 404 when loan is not found", async () => {
  mockDatabase([]);

  const response = await request(app)
    .get("/api/loans/999")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_NOT_FOUND");
});

test("POST /api/loans creates a loan with validated data when equipment is available", async () => {
  const availableEquipment: Equipment = {
    id: 1,
    name: "Microscopio",
    description: "Equipo óptico",
    status: "available",
  };
  const createdLoan: Loan = {
    id: 1,
    user_id: studentUser.id,
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

  const response = await request(app)
    .post("/api/loans")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({
      user_id: studentUser.id,
      equipment_id: createdLoan.equipment_id,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, createdLoan);

  const equipQuery = queries.find((q) => /FROM equipment/i.test(q[0]));
  assert.ok(equipQuery);
  assert.deepEqual(equipQuery[1], [createdLoan.equipment_id]);

  const insertQuery = queries.find((q) => /INSERT INTO loans/i.test(q[0]));
  assert.ok(insertQuery);
  assert.equal(insertQuery[1][0], studentUser.id);
  assert.equal(insertQuery[1][1], createdLoan.equipment_id);
  assert.equal(insertQuery[1][2], "pending");
});

test("POST /api/loans forbids creating a loan on behalf of another user", async () => {
  mockDatabase([]);

  const response = await request(app)
    .post("/api/loans")
    .set("Authorization", `Bearer ${studentToken}`) // user 1
    .send({
      user_id: otherStudentUser.id, // user 2
      equipment_id: 1,
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_CREATE_FORBIDDEN");
});

test("POST /api/loans refuses to create a loan when the equipment does not exist", async () => {
  const queries = mockDatabase((sql) => {
    if (/FROM equipment/i.test(sql)) {
      return [];
    }
    return [];
  });

  const response = await request(app)
    .post("/api/loans")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({
      user_id: studentUser.id,
      equipment_id: 999,
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "EQUIPMENT_NOT_FOUND");
  assert.equal(response.body.message, "Equipment not found");

  const insertQuery = queries.find((q) => /INSERT INTO loans/i.test(q[0]));
  assert.equal(insertQuery, undefined);
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

  const response = await request(app)
    .post("/api/loans")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({
      user_id: studentUser.id,
      equipment_id: 2,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "EQUIPMENT_NOT_AVAILABLE");
  assert.equal(response.body.message, "Equipment is not available for loan");

  const insertQuery = queries.find((q) => /INSERT INTO loans/i.test(q[0]));
  assert.equal(insertQuery, undefined);
});

test("POST /api/loans rejects invalid body data", async () => {
  const queries = mockDatabase([]);

  const response = await request(app)
    .post("/api/loans")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({
      user_id: -1,
      equipment_id: "not-a-number",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  const insertQuery = queries.find((q) => /INSERT INTO loans/i.test(q[0]));
  assert.equal(insertQuery, undefined);
});

test("PATCH /api/loans/:id/approve approves a pending loan and marks equipment as unavailable for manager", async () => {
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

  const response = await request(app)
    .patch("/api/loans/1/approve")
    .set("Authorization", `Bearer ${managerToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, approvedLoan);

  assert.ok(queries.some((q) => /UPDATE loans/i.test(q[0])));
  assert.ok(queries.some((q) => /UPDATE equipment/i.test(q[0])));
});

test("PATCH /api/loans/:id/approve rejects student role with 403", async () => {
  mockDatabase([]);

  const response = await request(app)
    .patch("/api/loans/1/approve")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "NOT_SUFFICIENT_PERMISSIONS");
});

test("PATCH /api/loans/:id/approve returns 404 when loan does not exist", async () => {
  mockDatabase([]);

  const response = await request(app)
    .patch("/api/loans/999/approve")
    .set("Authorization", `Bearer ${managerToken}`);

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

  const response = await request(app)
    .patch("/api/loans/1/approve")
    .set("Authorization", `Bearer ${managerToken}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_INVALID_STATUS");
  assert.equal(response.body.message, "Only pending loans can be approved");

  const updateQueries = queries.filter((q) => /UPDATE/i.test(q[0]));
  assert.equal(updateQueries.length, 0);
});

test("PATCH /api/loans/:id/reject rejects a pending loan for manager", async () => {
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

  const response = await request(app)
    .patch("/api/loans/1/reject")
    .set("Authorization", `Bearer ${managerToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, rejectedLoan);
});

test("PATCH /api/loans/:id/reject rejects student role with 403", async () => {
  mockDatabase([]);

  const response = await request(app)
    .patch("/api/loans/1/reject")
    .set("Authorization", `Bearer ${studentToken}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "NOT_SUFFICIENT_PERMISSIONS");
});

test("PATCH /api/loans/:id/reject returns 404 when loan does not exist", async () => {
  mockDatabase([]);

  const response = await request(app)
    .patch("/api/loans/999/reject")
    .set("Authorization", `Bearer ${managerToken}`);

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

  const response = await request(app)
    .patch("/api/loans/1/reject")
    .set("Authorization", `Bearer ${managerToken}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "LOAN_INVALID_STATUS");
  assert.equal(response.body.message, "Only pending loans can be rejected");

  const updateQueries = queries.filter((q) => /UPDATE/i.test(q[0]));
  assert.equal(updateQueries.length, 0);
});
