import pool from "../db.js";
import { hashPassword } from "../utils/password.js";

// Ejecución manual: nunca se crean usuarios privilegiados desde el registro público.
async function seed() {
  const accounts = (["ADMIN", "MANAGER"] as const).map((prefix) => {
    const email = process.env[`SEED_${prefix}_EMAIL`]?.trim().toLowerCase();
    const password = process.env[`SEED_${prefix}_PASSWORD`];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Define SEED_${prefix}_EMAIL con un correo válido.`);
    }
    if (
      !password ||
      password.trim().length < 16 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new Error(
        `SEED_${prefix}_PASSWORD debe tener al menos 16 caracteres y como máximo 72 bytes.`,
      );
    }
    return {
      email,
      password,
      role: prefix.toLowerCase(),
      name:
        prefix === "ADMIN" ? "Administrador LabTrack" : "Encargado LabTrack",
    };
  });
  if (
    accounts[0].email === accounts[1].email ||
    accounts[0].password === accounts[1].password
  ) {
    throw new Error("Usa correos y contraseñas diferentes para cada cuenta.");
  }
  if (!process.env.DATABASE_URL)
    throw new Error("Define DATABASE_URL antes de ejecutar el script.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(73419201)");
    for (const account of accounts) {
      const existing = await client.query<{ role: string; active: boolean }>(
        "SELECT role, active FROM users WHERE lower(email) = $1 FOR UPDATE",
        [account.email],
      );
      if (existing.rows.length) {
        if (
          existing.rows.length !== 1 ||
          existing.rows[0].role !== account.role ||
          !existing.rows[0].active
        ) {
          throw new Error(
            `La cuenta ${account.role} coincide con un usuario existente incompatible; no se modificó.`,
          );
        }
        // Repetir el script conserva la contraseña y las sesiones existentes.
        continue;
      }
      await client.query(
        "INSERT INTO users (name, email, password_hash, role, active, token_version) VALUES ($1, $2, $3, $4, true, 0)",
        [
          account.name,
          account.email,
          await hashPassword(account.password),
          account.role,
        ],
      );
    }
    await client.query("COMMIT");
    console.log(
      "Cuentas admin y manager listas. Los usuarios existentes conservaron sus contraseñas.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .catch((error: unknown) => {
    // No imprimir objetos de conexión ni valores de entorno.
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error(
      message.startsWith("Define ") ||
        message.startsWith("SEED_") ||
        message.startsWith("Usa ") ||
        message.startsWith("La cuenta ")
        ? message
        : "No se pudieron preparar las cuentas. Revisa la conexión y las migraciones 001 a 004.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
