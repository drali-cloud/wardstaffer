export type Gender = 'Male' | 'Female';

export interface DoctorRule {
  id: string;
  type: 'max_er_shifts' | 'forbidden_days' | 'ward_restriction';
  value: any;
}

export interface Doctor {
  id: string;
  name: string;
  gender: Gender;
  password?: string;
  role?: 'resident' | 'admin';
  previousWards: string[]; // List of ward IDs the doctor has worked in
  rules?: DoctorRule[];
}

export interface WardRequirements {
  totalDoctors: number;
  genderDiversity: 'None' | 'Balanced' | 'Specific';
  requiredMale?: number;
  requiredFemale?: number;
  shiftDuration: '6h' | '12h' | '24h';
  shiftWeight?: number;
  staffPerShift: 1 | 2;
}

export interface Ward {
  id: string;
  name: string;
  requirements: WardRequirements;
  parentWardId?: string;
  hiddenFromCalendar?: boolean;
}

export interface ShiftRecord {
  id: string;
  period: string; // YYYY-MM
  day: number;
  wardId: string;
  slotIndex: number; // 0, 1, 2...
  doctorId: string;
}

export interface Assignment {
  id: string;
  period: string; // YYYY-MM
  wardId: string;
  doctorIds: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'swap_er' | 'auto_balance' | 'manual_assign' | 'exchange_approved' | 'exchange_rejected';
  details: string;
  period: string;
}

export interface ShiftExchange {
  id: string;
  requesterId: string;       // doctor proposing the exchange
  requesterShiftId: string;  // their shift they want to give away
  targetDoctorId: string;    // doctor they want to swap with
  targetShiftId: string;     // target doctor's shift they want to receive
  period: string;            // YYYY-MM
  message?: string;          // optional note from requester
  // 3-stage workflow:
  // pending_target  → submitted by requester, waiting for target to accept/decline
  // target_accepted → target accepted; now visible to admin
  // target_declined → target declined; closed
  // approved        → admin approved and swap applied
  // rejected        → admin rejected
  status: 'pending_target' | 'target_accepted' | 'target_declined' | 'approved' | 'rejected';
  adminNote?: string;        // admin feedback
  createdAt: string;
  resolvedAt?: string;
}
