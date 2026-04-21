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

  // Memoized helpers
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
      
      if (!docsResp.ok || !wardsResp.ok || !assignmentsResp.ok) {
        throw new Error('Server synchronization failed.');
      }
      
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
      if (resp.ok) {
        onSuccess();
      } else {
        const text = await resp.text();
        alert(`${errorMsg}: ${text}`);
      }
    } catch (e) {
      console.error(errorMsg, e);
      alert(`${errorMsg}: Network or server error.`);
    } finally {
      setSyncing(false);
    }
  }, []);

  const addDoctor = useCallback((doctor: Doctor) => {
    executeAction(
      () => fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doctor)
      }),
      () => setData(prev => ({ ...prev, doctors: [...prev.doctors, doctor] })),
      'Failed to register physician'
    );
  }, [executeAction]);

  const updateDoctor = useCallback((doctor: Doctor) => {
    executeAction(
      () => fetch(`/api/doctors/${doctor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doctor)
      }),
      () => setData(prev => ({
        ...prev,
        doctors: prev.doctors.map(d => d.id === doctor.id ? doctor : d)
      })),
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
      () => fetch('/api/wards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ward)
      }),
      () => setData(prev => ({ ...prev, wards: [...prev.wards, ward] })),
      'Failed to initialize ward'
    );
  }, [executeAction]);

  const updateWard = useCallback((ward: Ward) => {
    executeAction(
      () => fetch(`/api/wards/${ward.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ward)
      }),
      () => setData(prev => ({
        ...prev,
        wards: prev.wards.map(w => w.id === ward.id ? ward : w)
      })),
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

  const generateAssignments = useCallback(async (date: string) => {
    // We use a snapshot of the current data for calculation
    const { doctors, wards } = data;
    const newAssignments: Assignment[] = [];
    const assignedDoctorIds = new Set<string>();

    // Priority sorting or randomization
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
        setSyncing(true);
        try {
            const resp = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAssignments)
            });
            
            if (!resp.ok) throw new Error('Failed to save assignments');

            const updatedDoctors = doctors.map(doc => {
                const assignment = newAssignments.find(a => a.doctorIds.includes(doc.id));
                if (assignment && !doc.previousWards.includes(assignment.wardId)) {
                    return { ...doc, previousWards: [...doc.previousWards, assignment.wardId] };
                }
                return doc;
            });

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
            console.error('Assignment sync error:', e);
            alert('Assignments generated but failed to sync to cloud.');
        } finally {
            setSyncing(false);
        }
    }

    return newAssignments;
  }, [data]);

  const importData = useCallback(async (newData: Partial<StaffingData>) => {
    executeAction(
      () => fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      }),
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
    ...data,
    loading,
    syncing,
    addDoctor,
    deleteDoctor,
    updateDoctor,
    addWard,
    deleteWard,
    updateWard,
    generateAssignments,
    importData,
    clearAssignments,
    doctorMap,
    wardMap
  };
}
