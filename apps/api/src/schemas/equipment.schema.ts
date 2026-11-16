import { z } from 'zod';

const equipmentSchema = {
  getEquipment: z.object({
    status: z.enum(['available', 'unavailable']).optional(),
  }),
  createEquipment: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Equipment name is required')
      .max(20, 'Equipment name must be at most 20 characters'),
    description: z
      .string()
      .trim()
      .max(200, 'Equipment description must be at most 200 characters')
      .optional(),
    status: z.enum(['available', 'unavailable']).default('available'),
  }),
};

export default equipmentSchema;