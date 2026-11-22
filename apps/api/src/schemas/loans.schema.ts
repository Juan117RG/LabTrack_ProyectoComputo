import { z } from "zod";

const loansSchema = {
  returnLoan: z.object({
    return_condition: z.string().trim().max(1000).optional(),
  }),
  loanId: z.object({
    id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  }),
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
  getLoansByUserId: z.object({
    userId: z.coerce
      .number()
      .int()
      .positive("User ID must be a positive integer"),
  }),
};

export default loansSchema;
