import loansRepository from '../repositories/loans.repository.js';
import type {
  CreateLoanData,
  Loan,
  LoanFilter,
} from '../types/loans.types.js';
import equipmentService from './equipment.service.js';

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
    // Check if the equipment is available before creating a loan
    const equipment = await equipmentService.getEquipmentById(loansData.equipment_id);
    if (!equipment) {
      throw new Error('Equipment not found');
    }
    else if (equipment.status !== 'available') {
      throw new Error('Equipment is not available for loan');
    }
    return loansRepository.createLoan(loansData);
  },
  approveLoan: async (id: string): Promise<Loan | null> => {
    const loan = await loansRepository.getLoanById(id);
    if (!loan) {
      return null;
    }

    if (loan.status !== 'pending') {
      throw new Error('Only pending loans can be approved');
    }
    const madeLoan = await loansRepository.updateLoanStatus(id, 'approved');
    await equipmentService.setEquipmentStatus(loan.equipment_id, 'unavailable');
    return madeLoan;
  },
  rejectLoan: async (id: string): Promise<Loan | null> => {
    const loan = await loansRepository.getLoanById(id);
    if (!loan) {
      return null;
    }

    if (loan.status !== 'pending') {
      throw new Error('Only pending loans can be rejected');
    }
    return loansRepository.updateLoanStatus(id, 'rejected');
  },
};

export default loansService;

