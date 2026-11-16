import { z } from 'zod';

const loansSchema = {
  getLoans: z.object({
    status: z.enum(['available', 'unavailable']).optional(),
  }),
  createLoan: z.object({
    user_id: z.number().int().positive('User ID must be a positive integer'),
    equipment_id: z.number().int().positive('Equipment ID must be a positive integer')
  })
};

export default loansSchema;
/*
    user_id BIGINT NOT NULL REFERENCES users(id),
    equipment_id BIGINT NOT NULL REFERENCES equipment(id),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'returned', 'rejected')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    return_condition TEXT
*/