import { useState, useEffect, useCallback } from 'react';
import { Doctor, Ward, Assignment, Gender } from '../types';

interface StaffingData {
  doctors: Doctor[];
  wards: Ward[];
  assignments: Assignment[];
}

export function useStaffingData() {
  const [data, setData] = useState<StaffingData>({ doctors: [], wards: [], assignments: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [docsResp, wardsResp, assignmentsResp] = await Promise.all([
        fetch('/api/doctors'),
        fetch('/api/wards'),
        fetch('/api/assignments')
      ]);
      
      if (!docsResp.ok || !wardsResp.ok || !assignmentsResp.ok) {
        throw new Error('Server returned an error while fetching data.');
      }
      
      const doctors = await docsResp.json();
      const wards = await wardsResp.json();
      const assignments = await assignmentsResp.json();
      
      if (Array.isArray(doctors) && Array.isArray(wards) && Array.isArray(assignments)) {
        setData({ doctors, wards, assignments });
      } else {
        console.error('Invalid data format received from server', { doctors, wards, assignments });
      }
    } catch (e) {
      console.error('Failed to fetch data from Postgres:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addDoctor = useCallback(async (doctor: Doctor) => {
    try {
        const resp = await fetch('/api/doctors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doctor)
        });
        if (resp.ok) {
          setData(prev => ({ ...prev, doctors: [...prev.doctors, doctor] }));
        } else {
          const err = await resp.json();
          alert('Failed to save doctor: ' + (err.error || 'Unknown error'));
        }
    } catch (e) {
        console.error('Failed to add doctor', e);
    }
  }, []);

  const deleteDoctor = useCallback(async (id: string) => {
    try {
        const resp = await fetch(`/api/doctors/${id}`, { method: 'DELETE' });
        if (resp.ok) {
          setData(prev => ({ ...prev, doctors: prev.doctors.filter(d => d.id !== id) }));
        }
    } catch (e) {
        console.error('Failed to delete doctor', e);
    }
  }, []);

  const addWard = useCallback(async (ward: Ward) => {
    try {
        const resp = await fetch('/api/wards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ward)
        });
        if (resp.ok) {
          setData(prev => ({ ...prev, wards: [...prev.wards, ward] }));
        } else {
          const err = await resp.json();
          alert('Failed to save ward: ' + (err.error || 'Unknown error'));
        }
    } catch (e) {
        console.error('Failed to add ward', e);
    }
  }, []);

  const deleteWard = useCallback(async (id: string) => {
    try {
        await fetch(`/api/wards/${id}`, { method: 'DELETE' });
        setData(prev => ({ ...prev, wards: prev.wards.filter(w => w.id !== id) }));
    } catch (e) {
        console.error('Failed to delete ward', e);
    }
  }, []);

  const generateAssignments = useCallback(async (date: string) => {
    const { doctors, wards } = data;
    const newAssignments: Assignment[] = [];
    const assignedDoctorIds = new Set<string>();

    const shuffledWards = [...wards].sort(() => Math.random() - 0.5);

    for (const ward of shuffledWards) {
      const { totalDoctors, genderDiversity, requiredMale, requiredFemale } = ward.requirements;
      const wardAssignments: string[] = [];

      const eligibleDoctors = doctors.filter(d => 
        !d.previousWards.includes(ward.id) && !assignedDoctorIds.has(d.id)
      );

      const pool = [...eligibleDoctors].sort(() => Math.random() - 0.5);

      if (genderDiversity === 'Balance') {
          const targetMale = Math.floor(totalDoctors / 2);
          const targetFemale = totalDoctors - targetMale;
          const males = pool.filter(d => d.gender === 'Male');
          const females = pool.filter(d => d.gender === 'Female');
          const others = pool.filter(d => d.gender !== 'Male' && d.gender !== 'Female');

          for (let i = 0; i < targetMale && males.length > 0; i++) {
              const doc = males.pop()!;
              wardAssignments.push(doc.id);
              assignedDoctorIds.add(doc.id);
          }
          for (let i = 0; i < targetFemale && females.length > 0; i++) {
              const doc = females.pop()!;
              wardAssignments.push(doc.id);
              assignedDoctorIds.add(doc.id);
          }
          const remainingPool = [...males, ...females, ...others].sort(() => Math.random() - 0.5);
          while (wardAssignments.length < totalDoctors && remainingPool.length > 0) {
              const doc = remainingPool.pop()!;
              wardAssignments.push(doc.id);
              assignedDoctorIds.add(doc.id);
          }
      } else if (genderDiversity === 'Specific') {
          const mReq = requiredMale ?? 0;
          const fReq = requiredFemale ?? 0;
          const males = pool.filter(d => d.gender === 'Male');
          const females = pool.filter(d => d.gender === 'Female');
          const others = pool.filter(d => d.gender !== 'Male' && d.gender !== 'Female');

          for (let i = 0; i < mReq && males.length > 0; i++) {
              const doc = males.pop()!;
              wardAssignments.push(doc.id);
              assignedDoctorIds.add(doc.id);
          }
          for (let i = 0; i < fReq && females.length > 0; i++) {
              const doc = females.pop()!;
              wardAssignments.push(doc.id);
              assignedDoctorIds.add(doc.id);
          }
          const remainingPool = [...males, ...females, ...others].sort(() => Math.random() - 0.5);
          while (wardAssignments.length < totalDoctors && remainingPool.length > 0) {
              const doc = remainingPool.pop()!;
              wardAssignments.push(doc.id);
              assignedDoctorIds.add(doc.id);
          }
      } else {
          while (wardAssignments.length < totalDoctors && pool.length > 0) {
              const doc = pool.pop()!;
              wardAssignments.push(doc.id);
              assignedDoctorIds.add(doc.id);
          }
      }

      if (wardAssignments.length > 0) {
        newAssignments.push({
          id: `${date}-${ward.id}`,
          date,
          wardId: ward.id,
          doctorIds: wardAssignments
        });
      }
    }

    if (newAssignments.length > 0) {
        try {
            await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAssignments)
            });
            
            const updatedDoctors = [...doctors].map(doc => {
                const assignment = newAssignments.find(a => a.doctorIds.includes(doc.id));
                if (assignment && !doc.previousWards.includes(assignment.wardId)) {
                    return { ...doc, previousWards: [...doc.previousWards, assignment.wardId] };
                }
                return doc;
            });

            // Update doctors previous wards on server
            const doctorsToUpdate = updatedDoctors.filter(d => 
                newAssignments.some(a => a.doctorIds.includes(d.id))
            );
            
            if (doctorsToUpdate.length > 0) {
                await fetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ doctors: doctorsToUpdate })
                });
            }

            setData(prev => ({
                ...prev,
                doctors: updatedDoctors,
                assignments: [...prev.assignments, ...newAssignments]
            }));
        } catch (e) {
            console.error('Failed to sync assignments to server', e);
        }
    }

    return newAssignments;
  }, [data]);

  const importData = useCallback(async (newData: Partial<StaffingData>) => {
      try {
          await fetch('/api/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newData)
          });
          await fetchData();
      } catch (e) {
          console.error('Failed to import data', e);
      }
  }, [fetchData]);

  const clearAssignments = useCallback(async () => {
    try {
        await fetch('/api/assignments', { method: 'DELETE' });
        setData(prev => ({ ...prev, assignments: [] }));
    } catch (e) {
        console.error('Failed to clear assignments', e);
    }
  }, []);

  const updateDoctor = useCallback(async (doctor: Doctor) => {
    try {
        await fetch(`/api/doctors/${doctor.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doctor)
        });
        setData(prev => ({
            ...prev,
            doctors: prev.doctors.map(d => d.id === doctor.id ? doctor : d)
        }));
    } catch (e) {
        console.error('Failed to update doctor', e);
    }
  }, []);

  const updateWard = useCallback(async (ward: Ward) => {
    try {
        await fetch(`/api/wards/${ward.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ward)
        });
        setData(prev => ({
            ...prev,
            wards: prev.wards.map(w => w.id === ward.id ? ward : w)
        }));
    } catch (e) {
        console.error('Failed to update ward', e);
    }
  }, []);

  return {
    ...data,
    loading,
    addDoctor,
    deleteDoctor,
    updateDoctor,
    addWard,
    deleteWard,
    updateWard,
    generateAssignments,
    importData,
    clearAssignments
  };
}
