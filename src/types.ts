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
  action: 'swap_er' | 'auto_balance' | 'manual_assign';
  details: string;
  period: string;
}
