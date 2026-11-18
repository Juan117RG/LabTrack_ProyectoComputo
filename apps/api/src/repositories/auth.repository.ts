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
    const query = `
      INSERT INTO ${authRepositoryName} (name, email, password_hash, role, active, token_version)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, role
    `;
    const values = [name, email, passwordHash, role, true, 0];
    const { rows } = await pool.query(query, values);
    const newUser = rows[0];
    //sanitize the newUser object to match the User type and keep sensitive info out
    delete newUser.password_hash;
    delete newUser.active;
    delete newUser.token_version;
    return newUser as User;
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
    const query = `
      UPDATE ${authRepositoryName}
      SET token_version = token_version + 1
      WHERE id = $1
    `;
    const values = [id];
    await pool.query(query, values);
  },
};

export default authRepository;
