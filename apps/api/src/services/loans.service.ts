import loansRepository from "../repositories/loans.repository.js";
import type { CreateLoanData, Loan, LoanFilter } from "../types/loans.types.js";
import equipmentService from "./equipment.service.js";

const loansService = {
  returnLoan: async (id: string, condition: string): Promise<Loan | null> => {
    return loansRepository.returnLoan(id, condition);
  },
  getLoans: async (filter: LoanFilter): Promise<Loan[]> => {
    return loansRepository.getLoans(filter);
  },
  getLoansByUserId: async (userId: number): Promise<Loan[]> => {
    return loansRepository.getLoansByUserId(userId);
  },
  getLoanById: async (id: string): Promise<Loan | null> => {
    const loan = await loansRepository.getLoanById(id);
    return loan || null;
  },
  createLoan: async (loansData: CreateLoanData): Promise<Loan> => {
    // Check if the equipment is available before creating a loan
    const equipment = await equipmentService.getEquipmentById(
      loansData.equipment_id,
    );
    if (!equipment) {
      throw new Error("Equipment not found");
    } else if (equipment.status !== "available") {
      throw new Error("Equipment is not available for loan");
    }
    return loansRepository.createLoan(loansData);
  },
  approveLoan: async (id: string): Promise<Loan | null> => {
    // La transacción atómica en el repositorio valida el préstamo, bloquea el equipo y actualiza ambos.
    return loansRepository.approveLoan(id);
  },
  rejectLoan: async (id: string): Promise<Loan | null> => {
    const loan = await loansRepository.getLoanById(id);
    if (!loan) {
      return null;
    }

    if (loan.status !== "pending") {
      throw new Error("Only pending loans can be rejected");
    }
    return loansRepository.updateLoanStatus(id, "rejected");
  },
};

export default loansService;
