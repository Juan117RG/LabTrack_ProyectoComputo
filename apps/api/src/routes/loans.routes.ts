import express from "express";
import { validate } from "../middleware/validate.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import loansSchema from "../schemas/loans.schema.js";
import loansController from "../controllers/loans.controller.js";
const router = express.Router();

router.get(
  "/",
  authMiddleware("manager"),
  validate(loansSchema.getLoans, "query"),
  loansController.getLoans,
);
router.get(
  "/user/:userId",
  authMiddleware("manager"),
  validate(loansSchema.getLoansByUserId, "params"),
  loansController.getLoansByUserId,
);
router.get(
  "/myloans",
  authMiddleware("student"),
  loansController.getLoansForCurrentUser,
);
router.get("/:id", authMiddleware("student"), loansController.getLoanById);
router.post(
  "/",
  authMiddleware("student"),
  validate(loansSchema.createLoan, "body"),
  loansController.createLoan,
);
router.patch(
  "/:id/approve",
  authMiddleware("manager"),
  loansController.approveLoan,
);
router.patch(
  "/:id/reject",
  authMiddleware("manager"),
  loansController.rejectLoan,
);

export default router;
