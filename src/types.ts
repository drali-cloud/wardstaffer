export type Gender = 'Male' | 'Female';

export interface Doctor {
  id: string;
  name: string;
  gender: Gender;
  password?: string;
  previousWards: string[]; // List of ward IDs the doctor has worked in
}

export interface WardRequirements {
  totalDoctors: number;
  genderDiversity: 'None' | 'Balanced' | 'Specific';
  requiredMale?: number;
  requiredFemale?: number;
  shiftDuration: '6h' | '12h' | '24h';
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
  action: 'swap_er' | 'auto_balance' | 'manual_assign';
  details: string;
  period: string;
}
