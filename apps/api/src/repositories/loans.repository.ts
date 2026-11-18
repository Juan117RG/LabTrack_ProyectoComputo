import pool from "../db.js";
import type { CreateLoanData, Loan, LoanFilter } from "../types/loans.types.js";

const loansRepositoryTableName = "loans";

const loansRepository = {
  getLoans: async ({ status }: LoanFilter = {}): Promise<Loan[]> => {
    const query = status
      ? `SELECT id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
         FROM ${loansRepositoryTableName}
         WHERE status = $1
         ORDER BY id`
      : `SELECT id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
         FROM ${loansRepositoryTableName}
         ORDER BY id`;
    const values = status ? [status] : [];
    const { rows } = await pool.query<Loan>(query, values);
    return rows;
  },
  getLoansByUserId: async (userId: number): Promise<Loan[]> => {
    const query = `
      SELECT id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
      FROM ${loansRepositoryTableName}
      WHERE user_id = $1
      ORDER BY id
    `;
    const values = [userId];
    const { rows } = await pool.query<Loan>(query, values);
    return rows;
  },
  getLoanById: async (id: string): Promise<Loan | null> => {
    const query = `
      SELECT id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
      FROM ${loansRepositoryTableName}
      WHERE id = $1
    `;
    const values = [id];
    const { rows } = await pool.query<Loan>(query, values);
    return rows.length > 0 ? rows[0] : null;
  },

  createLoan: async (loansData: CreateLoanData): Promise<Loan> => {
    const query = `
      INSERT INTO ${loansRepositoryTableName} (user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
    `;
    const values = [
      loansData.user_id,
      loansData.equipment_id,
      "pending", // Default status for new loans
      new Date().toISOString(), // requested_at
      null, // approved_at
      null, // returned_at
      null, // return_condition
    ];
    const { rows } = await pool.query<Loan>(query, values);
    return rows[0];
  },
  updateLoanStatus: async (
    id: string,
    newStatus: "approved" | "rejected" | "returned",
  ): Promise<Loan | null> => {
    const query = `
      UPDATE ${loansRepositoryTableName}
      SET status = $1,
          approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END,
          returned_at = CASE WHEN $1 = 'returned' THEN NOW() ELSE returned_at END
      WHERE id = $2
      RETURNING id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
    `;
    const values = [newStatus, id];
    const { rows } = await pool.query<Loan>(query, values);
    return rows.length > 0 ? rows[0] : null;
  },
};

export default loansRepository;
