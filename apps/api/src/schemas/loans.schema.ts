import { z } from "zod";

const loansSchema = {
  getLoans: z.object({
    status: z.enum(["pending", "approved", "returned", "rejected"]).optional(),
  }),
  createLoan: z.object({
    user_id: z.number().int().positive("User ID must be a positive integer"),
    equipment_id: z
      .number()
      .int()
      .positive("Equipment ID must be a positive integer"),
  }),
};

export default loansSchema;
