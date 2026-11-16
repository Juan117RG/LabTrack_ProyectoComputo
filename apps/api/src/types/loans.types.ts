export type LoanStatus = 'pending' | 'approved' | 'returned' | 'rejected';

export type LoanFilter = {
  status?: LoanStatus;
};

export type CreateLoanData = {
  user_id: number;
  equipment_id: number;
};

export type Loan = {
  id: number;
  user_id: number;
  equipment_id: number;
  status: LoanStatus;
  requested_at: string;
  approved_at: string | null;
  returned_at: string | null;
  return_condition: string | null;
};

