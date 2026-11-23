import pool from "../db.js";
import type { RegisterAuthData, LoginAuthData } from "../types/auth.types.js";
import type { User } from "../types/auth.types.js";
const authRepositoryName = "users";

const authRepository = {
  findByEmail: async (email: string) => {
    const query = `
      SELECT id, name, email, role, password_hash, active, token_version
      FROM ${authRepositoryName}
      WHERE email = $1
    `;
    const values = [email];
    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  },

  createUser: async (
    name: string,
    email: string,
    passwordHash: string,
    role: "student" | "manager",
  ) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const query = `
        INSERT INTO ${authRepositoryName} (name, email, password_hash, role, active, token_version)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, email, role
      `;
      const values = [name, email, passwordHash, role, true, 0];
      const { rows } = await client.query(query, values);
      if (rows.length === 0) {
        throw new Error("Failed to create user");
      }
      await client.query("COMMIT");
      const newUser = rows[0];
      delete newUser.password_hash;
      delete newUser.active;
      delete newUser.token_version;
      return newUser as User;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  findById: async (id: number) => {
    const query = `
      SELECT id, name, email, role, password_hash, active, token_version
      FROM ${authRepositoryName}
      WHERE id = $1
    `;
    const values = [id];
    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  },
  incrementTokenVersion: async (id: number) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const query = `
      UPDATE ${authRepositoryName}
      SET token_version = token_version + 1
      WHERE id = $1
    `;
      const values = [id];
      await client.query(query, values);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default authRepository;
