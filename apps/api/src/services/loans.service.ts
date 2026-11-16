import loansRepository from '../repositories/loans.repository.js';
import type {
  CreateLoanData,
  Loan,
  LoanFilter,
} from '../types/loans.types.js';

const loansService = {
  getLoans: async (filter: LoanFilter): Promise<Loan[]> => {
    return loansRepository.getLoans(filter);
  },
  getLoanById: async (id: string): Promise<Loan | null> => {
    const loan = await loansRepository.getLoanById(id);
    return loan || null;
  },
  createLoan: async (
    loansData: CreateLoanData,
  ): Promise<Loan> => {
    return loansRepository.createLoan(loansData);
  },
};

export default loansService;

