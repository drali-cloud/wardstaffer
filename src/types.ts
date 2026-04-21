export type Gender = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

export interface Doctor {
  id: string;
  name: string;
  gender: Gender;
  previousWards: string[]; // List of ward IDs the doctor has worked in
}

export interface WardRequirements {
  totalDoctors: number;
  genderDiversity: 'None' | 'Balanced' | 'Specific';
  requiredMale?: number;
  requiredFemale?: number;
}

export interface Ward {
  id: string;
  name: string;
  requirements: WardRequirements;
}

export interface Assignment {
  id: string;
  date: string;
  wardId: string;
  doctorIds: string[];
}
