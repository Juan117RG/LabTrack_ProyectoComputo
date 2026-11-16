import express from 'express';
import { validate } from '../middleware/validate.middleware.js';
import loansSchema from '../schemas/loans.schema.js';
import loansController from '../controllers/loans.controller.js';
const router = express.Router();

router.get(
  '/',
  validate(loansSchema.getLoans, 'query'),
  loansController.getLoans,
);
router.get(
  '/:id',
  loansController.getLoanById,
);
router.post(
  '/',
  validate(loansSchema.createLoan, 'body'),
  loansController.createLoan,
);
router.patch(
  '/:id/approve',
  loansController.approveLoan,
);
router.patch(
  '/:id/reject',
  loansController.rejectLoan,
);

export default router;