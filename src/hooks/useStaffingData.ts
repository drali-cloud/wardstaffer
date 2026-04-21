import { useState, useEffect, useCallback, useMemo } from 'react';
import { Doctor, Ward, Assignment, Gender } from '../types';

interface StaffingData {
  doctors: Doctor[];
  wards: Ward[];
  assignments: Assignment[];
}

export function useStaffingData() {
  const [data, setData] = useState<StaffingData>({ doctors: [], wards: [], assignments: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Memoized helpers for instant UI lookups
  const doctorMap = useMemo(() => new Map(data.doctors.map(d => [d.id, d])), [data.doctors]);
  const wardMap = useMemo(() => new Map(data.wards.map(w => [w.id, w])), [data.wards]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [docsResp, wardsResp, assignmentsResp] = await Promise.all([
        fetch('/api/doctors'),
        fetch('/api/wards'),
        fetch('/api/assignments')
      ]);
      
      if (!docsResp.ok || !wardsResp.ok || !assignmentsResp.ok) throw new Error('Cloud sync failed.');
      
      const [doctors, wards, assignments] = await Promise.all([
        docsResp.json(),
        wardsResp.json(),
        assignmentsResp.json()
      ]);
      
      if (Array.isArray(doctors) && Array.isArray(wards) && Array.isArray(assignments)) {
        setData({ doctors, wards, assignments });
      }
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const executeAction = useCallback(async (action: () => Promise<Response>, onSuccess: () => void, errorMsg: string) => {
    setSyncing(true);
    try {
      const resp = await action();
      if (resp.ok) onSuccess();
      else {
        const text = await resp.text();
        alert(`${errorMsg}: ${text}`);
      }
    } catch (e) {
      console.error(errorMsg, e);
      alert(`${errorMsg}: Connection error.`);
    } finally {
      setSyncing(false);
    }
  }, []);

  const addDoctor = useCallback((doctor: Doctor) => {
    executeAction(
      () => fetch('/api/doctors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doctor) }),
      () => setData(prev => ({ ...prev, doctors: [...prev.doctors, doctor] })),
      'Failed to register physician'
    );
  }, [executeAction]);

  const updateDoctor = useCallback((doctor: Doctor) => {
    executeAction(
      () => fetch(`/api/doctors/${doctor.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doctor) }),
      () => setData(prev => ({ ...prev, doctors: prev.doctors.map(d => d.id === doctor.id ? doctor : d) })),
      'Failed to update physician'
    );
  }, [executeAction]);

  const deleteDoctor = useCallback((id: string) => {
    executeAction(
      () => fetch(`/api/doctors/${id}`, { method: 'DELETE' }),
      () => setData(prev => ({ ...prev, doctors: prev.doctors.filter(d => d.id !== id) })),
      'Failed to remove physician'
    );
  }, [executeAction]);

  const addWard = useCallback((ward: Ward) => {
    executeAction(
      () => fetch('/api/wards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ward) }),
      () => setData(prev => ({ ...prev, wards: [...prev.wards, ward] })),
      'Failed to initialize ward'
    );
  }, [executeAction]);

  const updateWard = useCallback((ward: Ward) => {
    executeAction(
      () => fetch(`/api/wards/${ward.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ward) }),
      () => setData(prev => ({ ...prev, wards: prev.wards.map(w => w.id === ward.id ? ward : w) })),
      'Failed to update ward metrics'
    );
  }, [executeAction]);

  const deleteWard = useCallback((id: string) => {
    executeAction(
      () => fetch(`/api/wards/${id}`, { method: 'DELETE' }),
      () => setData(prev => ({ ...prev, wards: prev.wards.filter(w => w.id !== id) })),
      'Failed to decommission ward'
    );
  }, [executeAction]);

  // Pure logic for generating assignments without reading stale state
  const runGenerationLogic = (date: string, doctors: Doctor[], wards: Ward[]) => {
    const newAssignments: Assignment[] = [];
    const assignedDoctorIds = new Set<string>();
    const shuffledWards = [...wards].sort(() => Math.random() - 0.5);

    for (const ward of shuffledWards) {
      const { totalDoctors, genderDiversity, requiredMale, requiredFemale } = ward.requirements;
      const wardAssignments: string[] = [];
      const eligibleDoctors = doctors.filter(d => !d.previousWards.includes(ward.id) && !assignedDoctorIds.has(d.id));
      const pool = [...eligibleDoctors].sort(() => Math.random() - 0.5);

      if (genderDiversity === 'Balanced') {
          const targetMale = Math.floor(totalDoctors / 2);
          const targetFemale = totalDoctors - targetMale;
          const males = pool.filter(d => d.gender === 'Male');
          const females = pool.filter(d => d.gender === 'Female');
          
          for (let i = 0; i < targetMale && males.length > 0; i++) {
              const d = males.pop()!; wardAssignments.push(d.id); assignedDoctorIds.add(d.id);
          }
          for (let i = 0; i < targetFemale && females.length > 0; i++) {
              const d = females.pop()!; wardAssignments.push(d.id); assignedDoctorIds.add(d.id);
          }
          const remaining = [...males, ...females].sort(() => Math.random() - 0.5);
          while (wardAssignments.length < totalDoctors && remaining.length > 0) {
              const d = remaining.pop()!; wardAssignments.push(d.id); assignedDoctorIds.add(d.id);
          }
      } else if (genderDiversity === 'Specific') {
          const mReq = requiredMale ?? 0;
          const fReq = requiredFemale ?? 0;
          const males = pool.filter(d => d.gender === 'Male');
          const females = pool.filter(d => d.gender === 'Female');
          
          for (let i = 0; i < mReq && males.length > 0; i++) {
              const d = males.pop()!; wardAssignments.push(d.id); assignedDoctorIds.add(d.id);
          }
          for (let i = 0; i < fReq && females.length > 0; i++) {
              const d = females.pop()!; wardAssignments.push(d.id); assignedDoctorIds.add(d.id);
          }
          const remaining = [...males, ...females].sort(() => Math.random() - 0.5);
          while (wardAssignments.length < totalDoctors && remaining.length > 0) {
              const d = remaining.pop()!; wardAssignments.push(d.id); assignedDoctorIds.add(d.id);
          }
      } else {
          while (wardAssignments.length < totalDoctors && pool.length > 0) {
              const d = pool.pop()!; wardAssignments.push(d.id); assignedDoctorIds.add(d.id);
          }
      }

      if (wardAssignments.length > 0) {
        newAssignments.push({ id: `${date}-${ward.id}`, date, wardId: ward.id, doctorIds: wardAssignments });
      }
    }

    const updatedDoctors = doctors.map(doc => {
      const assignment = newAssignments.find(a => a.doctorIds.includes(doc.id));
      if (assignment && !doc.previousWards.includes(assignment.wardId)) {
          return { ...doc, previousWards: [...doc.previousWards, assignment.wardId] };
      }
      return doc;
    });

    return { newAssignments, updatedDoctors };
  };

  const generateAssignments = useCallback(async (date: string) => {
    setSyncing(true);
    try {
      const { newAssignments, updatedDoctors } = runGenerationLogic(date, data.doctors, data.wards);
      if (newAssignments.length === 0) return [];

      const resp = await fetch('/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAssignments) });
      if (!resp.ok) throw new Error('Assignment save failed');

      const doctorsToUpdate = updatedDoctors.filter(d => newAssignments.some(a => a.doctorIds.includes(d.id)));
      if (doctorsToUpdate.length > 0) {
          await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctors: doctorsToUpdate }) });
      }

      setData(prev => ({ ...prev, doctors: updatedDoctors, assignments: [...prev.assignments, ...newAssignments] }));
      return newAssignments;
    } catch (e) {
      alert('Cloud sync failed during assignment generation.');
      return [];
    } finally {
      setSyncing(false);
    }
  }, [data]);

  const generateMonthAssignments = useCallback(async (year: number, month: number) => {
    setSyncing(true);
    try {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let currentDoctors = [...data.doctors];
        let allNewAssignments: Assignment[] = [];
        let allUpdatedDoctors: Doctor[] = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const { newAssignments, updatedDoctors } = runGenerationLogic(dateStr, currentDoctors, data.wards);
            allNewAssignments.push(...newAssignments);
            currentDoctors = updatedDoctors; // Use updated state for next day
        }

        if (allNewAssignments.length > 0) {
            // Bulk Save
            await fetch('/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allNewAssignments) });
            
            // Bulk Update Doctors
            const modifiedDoctors = currentDoctors.filter(d => 
                allNewAssignments.some(a => a.doctorIds.includes(d.id))
            );
            await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctors: modifiedDoctors }) });
            
            setData(prev => ({ ...prev, doctors: currentDoctors, assignments: [...prev.assignments, ...allNewAssignments] }));
        }
        return allNewAssignments;
    } catch (e) {
        alert('Bulk generation failed.');
        return [];
    } finally {
        setSyncing(false);
    }
  }, [data]);

  const importData = useCallback(async (newData: Partial<StaffingData>) => {
    executeAction(
      () => fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newData) }),
      () => fetchData(),
      'Data import failed'
    );
  }, [executeAction, fetchData]);

  const clearAssignments = useCallback(() => {
    executeAction(
      () => fetch('/api/assignments', { method: 'DELETE' }),
      () => setData(prev => ({ ...prev, assignments: [] })),
      'Failed to clear assignments'
    );
  }, [executeAction]);

  return {
    ...data, loading, syncing, addDoctor, deleteDoctor, updateDoctor, addWard, deleteWard, updateWard, 
    generateAssignments, generateMonthAssignments, importData, clearAssignments, doctorMap, wardMap
  };
}
