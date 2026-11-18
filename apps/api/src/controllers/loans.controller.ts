import type { Request, Response } from "express";
import loansService from "../services/loans.service.js";
import type { CreateLoanData, LoanFilter } from "../types/loans.types.js";
import { errorResponse, successResponse } from "../utils/response.js";

const loansController = {
  getLoanById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };

      const loan = await loansService.getLoanById(id);
      if (!loan) {
        return errorResponse(res, "Loan not found", "LOAN_NOT_FOUND", 404, []);
      }
      if (
        res.locals.user.role === "student" &&
        res.locals.user.id !== loan?.user_id
      ) {
        return errorResponse(
          res,
          "You are not allowed to view this loan",
          "LOAN_VIEW_FORBIDDEN",
          403,
          [],
        );
      }
      return successResponse(res, "Loan obtained successfully", loan);
    } catch (error: unknown) {
      console.error("Error obtaining loan by ID:", error);
      return errorResponse(
        res,
        "Error obtaining loan by ID",
        "LOAN_FETCH_ERROR",
        500,
        [],
      );
    }
  },
  getLoans: async (_req: Request, res: Response) => {
    try {
      const { status } = res.locals.validatedData as LoanFilter;
      const loans = await loansService.getLoans({ status });
      return successResponse(res, "Loans obtained successfully", loans);
    } catch (error: unknown) {
      console.error("Error obtaining loans:", error);
      return errorResponse(
        res,
        "Error obtaining loans",
        "LOANS_FETCH_ERROR",
        500,
        [],
      );
    }
  },
  getLoansByUserId: async (req: Request, res: Response) => {
    try {
      const { userId } = res.locals.validatedData as { userId: number };
      const loans = await loansService.getLoansByUserId(userId);
      return successResponse(res, "Loans obtained successfully", loans);
    } catch (error: unknown) {
      console.error("Error obtaining loans by user ID:", error);
      return errorResponse(
        res,
        "Error obtaining loans by user ID",
        "LOANS_FETCH_ERROR",
        500,
        [],
      );
    }
  },
  getLoansForCurrentUser: async (_req: Request, res: Response) => {
    try {
      const userId = res.locals.user.id;
      const loans = await loansService.getLoansByUserId(userId);
      return successResponse(res, "Loans obtained successfully", loans);
    } catch (error: unknown) {
      console.error("Error obtaining loans for current user:", error);
      return errorResponse(
        res,
        "Error obtaining loans for current user",
        "LOANS_FETCH_ERROR",
        500,
        [],
      );
    }
  },
  createLoan: async (_req: Request, res: Response) => {
    try {
      const data = res.locals.validatedData as CreateLoanData;
      if (res.locals.user.id !== data.user_id) {
        return errorResponse(
          res,
          "You are not allowed to create a loan for another user",
          "LOAN_CREATE_FORBIDDEN",
          403,
          [],
        );
      }
      const loan = await loansService.createLoan(data);
      return successResponse(res, "Loan created successfully", loan);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "Equipment not found") {
          return errorResponse(
            res,
            "Equipment not found",
            "EQUIPMENT_NOT_FOUND",
            404,
            [],
          );
        }
        if (error.message === "Equipment is not available for loan") {
          return errorResponse(
            res,
            "Equipment is not available for loan",
            "EQUIPMENT_NOT_AVAILABLE",
            400,
            [],
          );
        }
      }
      console.error("Error creating loan:", error);
      return errorResponse(
        res,
        "Error creating loan",
        "LOAN_CREATE_ERROR",
        500,
        [],
      );
    }
  },
  approveLoan: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      if (res.locals.user.role !== "manager") {
        return errorResponse(
          res,
          "You are not allowed to approve loans",
          "LOAN_APPROVE_FORBIDDEN",
          403,
          [],
        );
      }
      const loan = await loansService.approveLoan(id);
      if (!loan) {
        return errorResponse(res, "Loan not found", "LOAN_NOT_FOUND", 404, []);
      }
      return successResponse(res, "Loan approved successfully", loan);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "Only pending loans can be approved"
      ) {
        return errorResponse(
          res,
          error.message,
          "LOAN_INVALID_STATUS",
          400,
          [],
        );
      }
      console.error("Error approving loan:", error);
      return errorResponse(
        res,
        "Error approving loan",
        "LOAN_APPROVE_ERROR",
        500,
        [],
      );
    }
  },
  rejectLoan: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      if (res.locals.user.role !== "manager") {
        return errorResponse(
          res,
          "You are not allowed to reject loans",
          "LOAN_REJECT_FORBIDDEN",
          403,
          [],
        );
      }
      const loan = await loansService.rejectLoan(id);
      if (!loan) {
        return errorResponse(res, "Loan not found", "LOAN_NOT_FOUND", 404, []);
      }
      return successResponse(res, "Loan rejected successfully", loan);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "Only pending loans can be rejected"
      ) {
        return errorResponse(
          res,
          error.message,
          "LOAN_INVALID_STATUS",
          400,
          [],
        );
      }
      console.error("Error rejecting loan:", error);
      return errorResponse(
        res,
        "Error rejecting loan",
        "LOAN_REJECT_ERROR",
        500,
        [],
      );
    }
  },
};

export default loansController;
