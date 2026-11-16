import pool from '../db.js';
import type {
    CreateLoansData,
    Loans,
    LoansFilter,
} from '../types/loans.types.js';

const loansRepositoryTableName = 'loans';

const loansRepository = {
  getLoans: async ({
    status,
  }: LoansFilter = {}): Promise<Loans[]> => {
    const query = status
      ? `SELECT id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
         FROM ${loansRepositoryTableName}
         WHERE status = $1
         ORDER BY id`
      : `SELECT id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
         FROM ${loansRepositoryTableName}
         ORDER BY id`;
    const values = status ? [status] : [];
    const { rows } = await pool.query<Loans>(query, values);
    return rows;
  },

  createLoan: async (
    loansData: CreateLoansData,
  ): Promise<Loans> => {
    const query = `
      INSERT INTO ${loansRepositoryTableName} (user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
    `;
    const values = [
      loansData.user_id,
      loansData.equipment_id,
      'pending', // Default status for new loans
      new Date().toISOString(), // requested_at
      null, // approved_at
      null, // returned_at
      null, // return_condition
    ];
    const { rows } = await pool.query<Loans>(query, values);
    return rows[0];
  },
};

export default loansRepository;
