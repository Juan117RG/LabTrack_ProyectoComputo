import pool from "../db.js";
import type { CreateLoanData, Loan, LoanFilter } from "../types/loans.types.js";

const loansRepositoryTableName = "loans";
const equipmentRepositoryTableName = "equipment";

const loansRepository = {
  rejectLoan: async (id: string): Promise<Loan | null> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Usa el mismo bloqueo que la aprobación para decidir sobre el estado actual.
      const { rows } = await client.query<Loan>(
        "SELECT * FROM loans WHERE id = $1 FOR UPDATE",
        [id],
      );
      const loan = rows[0];
      if (!loan) {
        await client.query("ROLLBACK");
        return null;
      }
      if (loan.status !== "pending") {
        throw new Error("Only pending loans can be rejected");
      }
      const rejected = await client.query<Loan>(
        `UPDATE loans SET status = 'rejected'
         WHERE id = $1 AND status = 'pending'
         RETURNING id, user_id, equipment_id, status, requested_at,
                   approved_at, returned_at, return_condition`,
        [id],
      );
      if (!rejected.rows.length) {
        throw new Error("Only pending loans can be rejected");
      }
      await client.query("COMMIT");
      return rejected.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  returnLoan: async (id: string, condition: string): Promise<Loan | null> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // El bloqueo impide registrar dos veces la misma devolución.
      const { rows } = await client.query<Loan>(
        "SELECT * FROM loans WHERE id = $1 FOR UPDATE",
        [id],
      );
      const loan = rows[0];
      if (!loan) {
        await client.query("ROLLBACK");
        return null;
      }
      if (loan.status !== "approved") {
        throw new Error("Only approved loans can be returned");
      }
      const returned = await client.query<Loan>(
        `UPDATE loans
         SET status = 'returned', returned_at = NOW(), return_condition = $2
         WHERE id = $1 RETURNING *`,
        [id, condition || null],
      );
      // Ambos cambios se guardan juntos; un error deshace la operación completa.
      const equipment = await client.query(
        `UPDATE ${equipmentRepositoryTableName} SET status = 'available' WHERE id = $1 RETURNING id`,
        [loan.equipment_id],
      );
      if (!equipment.rows.length) {
        throw new Error("Equipment not found");
      }
      await client.query("COMMIT");
      return returned.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
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
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const equipmentResult = await client.query<{
        id: number;
        status: string;
      }>(
        `SELECT * FROM ${equipmentRepositoryTableName} WHERE id = $1 FOR UPDATE`,
        [loansData.equipment_id],
      );
      const equipment = equipmentResult.rows[0];
      if (!equipment) {
        throw new Error("Equipment not found");
      }
      if (equipment.status !== "available") {
        throw new Error("Equipment is not available for loan");
      }
      const query = `
        INSERT INTO ${loansRepositoryTableName} (user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition
      `;
      const values = [
        loansData.user_id,
        loansData.equipment_id,
        "pending", // Default status
        new Date().toISOString(), // requested_at
        null, // approved_at
        null, // returned_at
        null, // return_condition
      ];
      const { rows } = await client.query<Loan>(query, values);
      await client.query("COMMIT");
      return rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  approveLoan: async (id: string): Promise<Loan | null> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<Loan>(
        `SELECT * FROM ${loansRepositoryTableName} WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const loan = rows[0];
      if (!loan) {
        await client.query("ROLLBACK");
        return null;
      }
      if (loan.status !== "pending") {
        throw new Error("Only pending loans can be approved");
      }
      const eqResult = await client.query<{ id: number; status: string }>(
        `SELECT * FROM ${equipmentRepositoryTableName} WHERE id = $1 FOR UPDATE`,
        [loan.equipment_id],
      );
      const equipment = eqResult.rows[0];
      if (!equipment) {
        throw new Error("Equipment not found");
      }
      if (equipment.status !== "available") {
        throw new Error("Equipment is not available for loan");
      }

      const query = `
        UPDATE ${loansRepositoryTableName}
        SET status = 'approved',
            approved_at = NOW()
        WHERE id = $1
        RETURNING id, user_id, equipment_id, status, requested_at, approved_at, returned_at, return_condition`;
      const { rows: updatedRows } = await client.query<Loan>(query, [id]);

      const equipmentQuery = `
        UPDATE ${equipmentRepositoryTableName}
        SET status = 'unavailable'
        WHERE id = $1
        RETURNING id, name, description, status`;
      await client.query(equipmentQuery, [loan.equipment_id]);

      await client.query("COMMIT");
      return updatedRows.length > 0 ? updatedRows[0] : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default loansRepository;
