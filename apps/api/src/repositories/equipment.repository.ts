import pool from "../db.js";
import type {
  CreateEquipmentData,
  Equipment,
  EquipmentFilter,
} from "../types/equipment.types.js";

const equipmentRepositoryTableName = "equipment";

const equipmentRepository = {
  getEquipment: async ({ status }: EquipmentFilter = {}): Promise<
    Equipment[]
  > => {
    const query = status
      ? `SELECT id, name, description, status
         FROM ${equipmentRepositoryTableName}
         WHERE status = $1
         ORDER BY id`
      : `SELECT id, name, description, status
         FROM ${equipmentRepositoryTableName}
         ORDER BY id`;
    const values = status ? [status] : [];
    const { rows } = await pool.query<Equipment>(query, values);
    return rows;
  },

  createEquipment: async (
    equipmentData: CreateEquipmentData,
  ): Promise<Equipment> => {
    const query = `
      INSERT INTO ${equipmentRepositoryTableName} (name, description, status)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, status
    `;
    const values = [
      equipmentData.name,
      equipmentData.description ?? null,
      equipmentData.status,
    ];
    const { rows } = await pool.query<Equipment>(query, values);
    return rows[0];
  },

  getEquipmentById: async (id: number): Promise<Equipment | null> => {
    const query = `
      SELECT id, name, description, status
      FROM ${equipmentRepositoryTableName}
      WHERE id = $1
    `;
    const values = [id];
    const { rows } = await pool.query<Equipment>(query, values);
    return rows.length > 0 ? rows[0] : null;
  },
  updateEquipmentStatus: async (
    id: number,
    newStatus: "available" | "unavailable",
  ): Promise<Equipment | null> => {
    const query = `
      UPDATE ${equipmentRepositoryTableName}
      SET status = $1
      WHERE id = $2
      RETURNING id, name, description, status
    `;
    const values = [newStatus, id];
    const { rows } = await pool.query<Equipment>(query, values);
    return rows.length > 0 ? rows[0] : null;
  },
};

export default equipmentRepository;
