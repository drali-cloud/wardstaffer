import { useState, useEffect, useCallback, useMemo } from 'react';
import { Doctor, Ward, Assignment, Gender, ShiftRecord } from '../types';

interface StaffingData {
  doctors: Doctor[];
  wards: Ward[];
  assignments: Assignment[];
  shifts: ShiftRecord[];
}

export function useStaffingData() {
  const [data, setData] = useState<StaffingData>({ doctors: [], wards: [], assignments: [], shifts: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [erConfig, setErConfig] = useState<{ men: string[], women: string[], pediatric: string[] }>({ men: [], women: [], pediatric: [] });

  const doctorMap = useMemo(() => new Map(data.doctors.map(d => [d.id, d])), [data.doctors]);
  const wardMap = useMemo(() => new Map(data.wards.map(w => [w.id, w])), [data.wards]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsResp, wardsResp, assignmentsResp, shiftsResp, configResp] = await Promise.all([
        fetch('/api/doctors'), fetch('/api/wards'), fetch('/api/assignments'), fetch('/api/shifts'), fetch('/api/config')
      ]);
      if (!docsResp.ok) throw new Error('Sync failed.');
      const [doctors, wards, assignments, shifts, config] = await Promise.all([
        docsResp.json(), wardsResp.json(), assignmentsResp.json(), shiftsResp.json(), configResp.json()
      ]);
      setData({ 
          doctors: doctors || [], 
          wards: wards || [], 
          assignments: assignments || [], 
          shifts: shifts || [] 
      });
      setErConfig(config || { men: [], women: [], pediatric: [] });
    } catch (e) { console.error('Fetch error:', e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const updateERConfig = useCallback(async (newConfig: { men: string[], women: string[], pediatric: string[] }) => {
    setSyncing(true);
    try {
        await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newConfig) });
        setErConfig(newConfig);
    } catch (e) { alert('Failed to save configuration.'); } finally { setSyncing(false); }
  }, []);

  const executeAction = useCallback(async (action: () => Promise<Response>, onSuccess: () => void, errorMsg: string) => {
    setSyncing(true);
    try {
      const resp = await action();
      if (resp.ok) onSuccess();
      else { const text = await resp.text(); alert(`${errorMsg}: ${text}`); }
    } catch (e) { alert(`${errorMsg}: Connection error.`); } finally { setSyncing(false); }
  }, []);

  const addDoctor = useCallback((doctor: Doctor) => {
    executeAction(() => fetch('/api/doctors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doctor) }), () => setData(prev => ({ ...prev, doctors: [...prev.doctors, doctor] })), 'Failed to register physician');
  }, [executeAction]);

  const updateDoctor = useCallback((doctor: Doctor) => {
    executeAction(() => fetch(`/api/doctors/${doctor.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doctor) }), () => setData(prev => ({ ...prev, doctors: prev.doctors.map(d => d.id === doctor.id ? doctor : d) })), 'Failed to update physician');
  }, [executeAction]);

  const deleteDoctor = useCallback((id: string) => {
    executeAction(() => fetch(`/api/doctors/${id}`, { method: 'DELETE' }), () => setData(prev => ({ ...prev, doctors: prev.doctors.filter(d => d.id !== id) })), 'Failed to remove physician');
  }, [executeAction]);

  const addWard = useCallback((ward: Ward) => {
    executeAction(() => fetch('/api/wards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ward) }), () => setData(prev => ({ ...prev, wards: [...prev.wards, ward] })), 'Failed to initialize ward');
  }, [executeAction]);

  const updateWard = useCallback((ward: Ward) => {
    executeAction(() => fetch(`/api/wards/${ward.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ward) }), () => setData(prev => ({ ...prev, wards: prev.wards.map(w => w.id === ward.id ? ward : w) })), 'Failed to update ward metrics');
  }, [executeAction]);

  const deleteWard = useCallback((id: string) => {
    executeAction(() => fetch(`/api/wards/${id}`, { method: 'DELETE' }), () => setData(prev => ({ ...prev, wards: prev.wards.filter(w => w.id !== id) })), 'Failed to decommission ward');
  }, [executeAction]);

  const generateMonthlyDispatch = useCallback(async (period: string) => {
    if (data.doctors.length === 0 || data.wards.length === 0) {
        alert('Missing staff or wards. Please configure registry first.');
        return [];
    }
    setSyncing(true);
    try {
      const { doctors, wards } = data;
      const newAssignments: Assignment[] = [];
      const assignedDoctorIds = new Set<string>();
      const shuffledWards = [...wards].sort(() => Math.random() - 0.5);

      for (const ward of shuffledWards) {
        const { totalDoctors, genderDiversity, requiredMale = 0, requiredFemale = 0 } = ward.requirements;
        const wardAssignments: string[] = [];
        
        const getEligible = (gender?: Gender) => doctors.filter(d => 
            !assignedDoctorIds.has(d.id) && 
            (!gender || d.gender === gender)
        );

        const pickFromPool = (pool: Doctor[], count: number) => {
            const prioritized = pool.filter(d => !d.previousWards.includes(ward.id));
            const others = pool.filter(d => d.previousWards.includes(ward.id));
            
            // Sort both for randomness
            prioritized.sort(() => Math.random() - 0.5);
            others.sort(() => Math.random() - 0.5);
            
            const combined = [...prioritized, ...others];
            for (let i = 0; i < count && combined.length > 0; i++) {
                const d = combined.shift()!;
                wardAssignments.push(d.id);
                assignedDoctorIds.add(d.id);
            }
        };

        if (genderDiversity === 'Specific') {
            pickFromPool(getEligible('Male'), requiredMale);
            pickFromPool(getEligible('Female'), requiredFemale);
        } else if (genderDiversity === 'Balanced') {
            const half = Math.ceil(totalDoctors / 2);
            pickFromPool(getEligible('Male'), half);
            pickFromPool(getEligible('Female'), totalDoctors - wardAssignments.length);
        }

        // Final Fill: If still need doctors (or if policy was 'None')
        const remainingNeeded = totalDoctors - wardAssignments.length;
        if (remainingNeeded > 0) {
            pickFromPool(getEligible(), remainingNeeded);
        }

        if (wardAssignments.length > 0) {
          newAssignments.push({ id: `${period}-${ward.id}`, period, wardId: ward.id, doctorIds: wardAssignments });
        }
      }

      if (newAssignments.length === 0) { throw new Error('Could not generate any assignments'); }

      // Sync both assignments and updated doctors in one call
      const updatedDoctors = doctors.map(doc => {
        const assignment = newAssignments.find(a => a.doctorIds.includes(doc.id));
        if (assignment && !doc.previousWards.includes(assignment.wardId)) {
            return { ...doc, previousWards: [...doc.previousWards, assignment.wardId] };
        }
        return doc;
      });
      const docsToSync = updatedDoctors.filter(d => newAssignments.some(a => a.doctorIds.includes(d.id)));

      const resp = await fetch('/api/dispatch', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ assignments: newAssignments, doctors: docsToSync }) 
      });
      
      if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'Server rejected the dispatch save');
      }

      setData(prev => ({ ...prev, doctors: updatedDoctors, assignments: [...prev.assignments, ...newAssignments] }));
      return newAssignments;
    } catch (e: any) { 
        console.error('Dispatch error:', e);
        alert(`Generation failed: ${e.message || 'Check connection'}`);
        return []; 
    } finally { setSyncing(false); }
  }, [data]);

  const calculateTotalHours = useCallback((doctorId: string, period?: string, customShifts?: ShiftRecord[]) => {
    const shiftsToUse = customShifts || data.shifts;
    return shiftsToUse
        .filter(s => s.doctorId === doctorId && (!period || s.period === period))
        .reduce((total, s) => {
            if (s.wardId === 'er-referral') return total + 24;
            if (s.wardId.startsWith('er-')) return total + 12;
            return total + 24; // Ward shifts are 24h
        }, 0);
  }, [data.shifts]);

  const calculateDailyRoster = useCallback(async (period: string) => {
      setSyncing(true);
      try {
          const assignments = data.assignments.filter(a => a.period === period);
          if (assignments.length === 0) { alert('Dispatch staff first for this month.'); return; }
          
          const newShifts: ShiftRecord[] = [];
          const [year, month] = period.split('-').map(Number);
          const daysInMonth = new Date(year, month, 0).getDate();

          for (const assignment of assignments) {
              const ward = data.wards.find(w => w.id === assignment.wardId);
              if (!ward) continue;
              if (ward.parentWardId) continue;

              const subordinates = data.wards.filter(w => w.parentWardId === ward.id);
              const subAssignments = assignments.filter(a => subordinates.some(s => s.id === a.wardId));
              // Ensure pool is unique to prevent bias
              const combinedDoctorPool = Array.from(new Set([...assignment.doctorIds, ...subAssignments.flatMap(a => a.doctorIds)]));
              
              if (combinedDoctorPool.length === 0) continue;

              const { staffPerShift, shiftDuration } = ward.requirements;
              const shiftsPerDay = shiftDuration === '6h' ? 4 : shiftDuration === '12h' ? 2 : 1;
              const totalDailySlots = shiftsPerDay * staffPerShift;

              // GLOBAL CIRCULAR QUEUE: Ensures every doctor works once before anyone repeats
              let poolQueue = [...combinedDoctorPool].sort(() => Math.random() - 0.5);
              let lastDayAssigned = new Set<string>();

              for (let day = 1; day <= daysInMonth; day++) {
                  const todayAssigned = new Set<string>();
                  for (let slot = 0; slot < totalDailySlots; slot++) {
                      // SELECTION CRITERIA:
                      // 1. Must not have worked earlier today
                      // 2. Must not have worked yesterday (Rest Period Guard)
                      // 3. Must be the next in line in the global fairness queue
                      
                      let eligible = poolQueue.filter(id => !todayAssigned.has(id) && !lastDayAssigned.has(id));
                      
                      // EMERGENCY FALLBACK: If rest period is impossible (pool too small), avoid same-day double shifts
                      if (eligible.length === 0) {
                          eligible = poolQueue.filter(id => !todayAssigned.has(id));
                      }
                      
                      // CRITICAL FALLBACK: If everyone is already working today, pick from the queue
                      if (eligible.length === 0) eligible = poolQueue;

                      // Always pick the highest person in the queue who is eligible
                      const dId = eligible[0];
                      
                      // Move to the very back of the circular queue
                      poolQueue = [...poolQueue.filter(id => id !== dId), dId];
                      
                      todayAssigned.add(dId);
                      newShifts.push({ 
                          id: `${period}-${day}-${ward.id}-${slot}`, 
                          period, day, wardId: ward.id, slotIndex: slot, doctorId: dId 
                      });
                  }
                  lastDayAssigned = todayAssigned;
              }
          }

          // Save to Cloud
          await fetch('/api/shifts', { 
              method: 'DELETE', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ period }) 
          });
          const resp = await fetch('/api/shifts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newShifts)
          });
          if (resp.ok) {
              setData(prev => ({ ...prev, shifts: [...prev.shifts.filter(s => s.period !== period), ...newShifts] }));
              alert(`Roster generated for ${daysInMonth} days.`);
          }
      } catch (e) { alert('Roster calculation failed.'); } finally { setSyncing(false); }
  }, [data.assignments, data.wards, wardMap]);

  const clearRosterByPeriod = useCallback(async (period: string, type: 'all' | 'er' | 'ward' = 'all') => {
    if (!confirm(`Are you sure you want to delete ${type === 'all' ? 'ALL' : type.toUpperCase()} shifts for ${period}?`)) return;
    setSyncing(true);
    try {
        await fetch('/api/shifts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period, type }) });
        setData(prev => ({ 
            ...prev, 
            shifts: prev.shifts.filter(s => {
                if (s.period !== period) return true;
                if (type === 'er') return !s.wardId.startsWith('er-');
                if (type === 'ward') return s.wardId.startsWith('er-');
                return false; 
            })
        }));
    } catch (e) { alert('Clear failed.'); } finally { setSyncing(false); }
  }, []);

  const deleteDispatchByPeriod = useCallback(async (period: string) => {
    const toDelete = data.assignments.filter(a => a.period === period).map(a => a.id);
    if (toDelete.length === 0) return;
    setSyncing(true);
    try {
        await Promise.all([
            fetch('/api/assignments/bulk', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: toDelete }) }),
            fetch('/api/shifts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }) })
        ]);
        setData(prev => ({ 
            ...prev, 
            assignments: prev.assignments.filter(a => !toDelete.includes(a.id)),
            shifts: prev.shifts.filter(s => s.period !== period)
        }));
    } catch (e) { alert('Delete failed.'); } finally { setSyncing(false); }
  }, [data.assignments]);

  const updateAssignment = useCallback(async (assignment: Assignment) => {
    setSyncing(true);
    try {
        const resp = await fetch(`/api/assignments/${assignment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assignment) });
        if (resp.ok) {
            setData(prev => ({ ...prev, assignments: prev.assignments.map(a => a.id === assignment.id ? assignment : a) }));
            const doctorsToUpdate = assignment.doctorIds.map(id => doctorMap.get(id)).filter((d): d is Doctor => !!d && !d.previousWards.includes(assignment.wardId));
            if (doctorsToUpdate.length > 0) {
                const updatedDocs = doctorsToUpdate.map(d => ({ ...d, previousWards: [...d.previousWards, assignment.wardId] }));
                await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctors: updatedDocs }) });
                setData(prev => ({ ...prev, doctors: prev.doctors.map(d => updatedDocs.find(ud => ud.id === d.id) || d) }));
            }
        }
    } catch (e) { alert('Update failed.'); } finally { setSyncing(false); }
  }, [doctorMap]);

  const swapPoolDoctors = useCallback(async (period: string, wardA: string, docA: string, wardB: string, docB: string) => {
    setSyncing(true);
    try {
        const assignments = data.assignments.filter(a => a.period === period);
        const a1 = assignments.find(a => a.wardId === wardA);
        const a2 = assignments.find(a => a.wardId === wardB);
        if (!a1 || !a2) return;

        const newA1 = { ...a1, doctorIds: a1.doctorIds.map(id => id === docA ? docB : id) };
        const newA2 = { ...a2, doctorIds: a2.doctorIds.map(id => id === docB ? docA : id) };

        // Deep Swap: Switch all associated shifts for this month
        const updatedShifts = data.shifts.map(s => {
            if (s.period !== period) return s;
            if (s.doctorId === docA) return { ...s, doctorId: docB };
            if (s.doctorId === docB) return { ...s, doctorId: docA };
            return s;
        });
        
        const shiftsToPersist = updatedShifts.filter(s => s.period === period && (s.doctorId === docA || s.doctorId === docB));

        await Promise.all([
            fetch(`/api/assignments/${newA1.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newA1) }),
            fetch(`/api/assignments/${newA2.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newA2) }),
            fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shiftsToPersist) })
        ]);

        setData(prev => ({
            ...prev,
            assignments: prev.assignments.map(a => a.id === newA1.id ? newA1 : a.id === newA2.id ? newA2 : a),
            shifts: updatedShifts
        }));
    } catch (e) { alert('Swap failed.'); } finally { setSyncing(false); }
  }, [data.assignments, data.shifts]);

  const swapShiftDoctors = useCallback(async (period: string, shiftIdA: string, shiftIdB: string) => {
    setSyncing(true);
    try {
        const s1 = data.shifts.find(s => s.id === shiftIdA);
        const s2 = data.shifts.find(s => s.id === shiftIdB);
        if (!s1 || !s2) return;

        const newS1 = { ...s1, doctorId: s2.doctorId };
        const newS2 = { ...s2, doctorId: s1.doctorId };

        await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([newS1, newS2])
        });

        setData(prev => ({
            ...prev,
            shifts: prev.shifts.map(s => s.id === shiftIdA ? newS1 : s.id === shiftIdB ? newS2 : s)
        }));
    } catch (e) { alert('Shift swap failed.'); } finally { setSyncing(false); }
  }, [data.shifts]);

  const calculateERCalls = useCallback(async (period: string, config: { men: string[], women: string[], pediatric: string[] }) => {
    setSyncing(true);
    try {
        const daysInMonth = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).getDate();
        const wardShifts = data.shifts.filter(s => s.period === period);
        const newERShifts: ShiftRecord[] = [];
        
        const categories = [
            { id: 'er-men', name: 'Men', slots: [2, 4, 4, 2], wards: config.men, duration: 6 },
            { id: 'er-women', name: 'Women', slots: [2, 4, 4, 2], wards: config.women, duration: 6 },
            { id: 'er-pediatric', name: 'Pediatric', slots: [1, 1, 1], wards: config.pediatric, duration: 8 },
            { id: 'er-referral', name: 'Daily Referral', slots: [1], wards: [...config.men, ...config.women, ...config.pediatric], duration: 24, maleOnly: true }
        ];

        // Track cumulative hours per doctor for the period
        const hoursMap: Record<string, number> = {};
        data.doctors.forEach(d => hoursMap[d.id] = 0);

        for (let day = 1; day <= daysInMonth; day++) {
            categories.forEach(cat => {
                const pool = new Set<string>();
                cat.wards.forEach(wId => {
                    const assignment = data.assignments.find(a => a.period === period && a.wardId === wId);
                    assignment?.doctorIds.forEach(dId => pool.add(dId));
                });
                
                const poolArray = Array.from(pool);
                if (poolArray.length === 0) return;

                cat.slots.forEach((staffCount, slotIdx) => {
                    for (let s = 0; s < staffCount; s++) {
                        // Pass 1: Strict (with rest periods)
                        let eligible = poolArray
                            .filter(candidate => {
                                const doc = doctorMap.get(candidate);
                                if (cat.maleOnly && doc?.gender !== 'Male') return false;

                                const hasWardShiftToday = wardShifts.some(s => s.day === day && s.doctorId === candidate);
                                const hasWardShiftYesterday = wardShifts.some(s => s.day === day - 1 && s.doctorId === candidate);
                                const hasWardShiftTomorrow = wardShifts.some(s => s.day === day + 1 && s.doctorId === candidate);
                                const hasOtherERToday = newERShifts.some(s => s.day === day && s.doctorId === candidate);
                                return !hasWardShiftToday && !hasWardShiftYesterday && !hasWardShiftTomorrow && !hasOtherERToday;
                            })
                            .sort((a, b) => hoursMap[a] - hoursMap[b]);

                        // Pass 2: Relaxed (No same-day conflict only)
                        if (eligible.length === 0) {
                            eligible = poolArray
                                .filter(candidate => {
                                    const doc = doctorMap.get(candidate);
                                    if (cat.maleOnly && doc?.gender !== 'Male') return false;

                                    const hasWardShiftToday = wardShifts.some(s => s.day === day && s.doctorId === candidate);
                                    const hasOtherERToday = newERShifts.some(s => s.day === day && s.doctorId === candidate);
                                    return !hasWardShiftToday && !hasOtherERToday;
                                })
                                .sort((a, b) => hoursMap[a] - hoursMap[b]);
                        }

                        if (eligible.length > 0) {
                            const candidate = eligible[0];
                            newERShifts.push({
                                id: `er-${cat.id}-${day}-${slotIdx}-${s}`,
                                period, day, wardId: cat.id, doctorId: candidate, slotIndex: slotIdx
                            });
                            hoursMap[candidate] += cat.duration;
                        }
                    }
                });
            });
        }

        await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newERShifts) });
        setData(prev => ({ ...prev, shifts: [...prev.shifts.filter(s => !(s.period === period && s.wardId.startsWith('er-'))), ...newERShifts] }));
    } catch (e) { alert('ER calculation failed.'); } finally { setSyncing(false); }
  }, [data]);

  const importData = useCallback(async (newData: Partial<StaffingData>) => {
    executeAction(() => fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newData) }), () => fetchData(), 'Data import failed');
  }, [executeAction]);

  const manualAssignDoctor = useCallback(async (doctorId: string, wardId: string, period: string) => {
    setSyncing(true);
    try {
        const assignment = data.assignments.find(a => a.period === period && a.wardId === wardId);
        const ward = data.wards.find(w => w.id === wardId);
        let newAssignments = [...data.assignments];
        let newWards = [...data.wards];
        let updatedDoctorIds = assignment ? [...assignment.doctorIds] : [];
        
        if (!updatedDoctorIds.includes(doctorId)) {
            updatedDoctorIds.push(doctorId);
            // Auto-expand capacity if full
            if (ward && updatedDoctorIds.length > ward.requirements.totalDoctors) {
                const updatedWard = { ...ward, requirements: { ...ward.requirements, totalDoctors: updatedDoctorIds.length } };
                newWards = newWards.map(w => w.id === wardId ? updatedWard : w);
                await fetch(`/api/wards/${wardId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedWard) });
            }
        }

        if (assignment) {
            newAssignments = newAssignments.map(a => a.id === assignment.id ? { ...a, doctorIds: updatedDoctorIds } : a);
        } else {
            newAssignments.push({ id: `${period}-${wardId}`, period, wardId, doctorIds: [doctorId] });
        }

        const doc = data.doctors.find(d => d.id === doctorId);
        const updatedDocs = data.doctors.map(d => d.id === doctorId && !d.previousWards.includes(wardId) ? { ...d, previousWards: [...d.previousWards, wardId] } : d);

        await fetch('/api/dispatch', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ assignments: newAssignments, doctors: updatedDocs.filter(d => d.id === doctorId) }) 
        });

        setData(prev => ({ ...prev, assignments: newAssignments, doctors: updatedDocs, wards: newWards }));
    } catch (e) { alert('Manual assignment failed.'); } finally { setSyncing(false); }
  }, [data]);

  const autoBalanceWorkload = useCallback(async (period: string, excludedWardIds: string[] = []) => {
    setSyncing(true);
    try {
        let currentShifts = [...data.shifts];
        const periodAssignments = data.assignments.filter(a => a.period === period);
        let iterations = 0;
        const maxIterations = 50; // Safety cap

        while (iterations < maxIterations) {
            // 1. Calculate hours for ELIGIBLE doctors only
            const stats = data.doctors
                .filter(d => {
                    const assignment = periodAssignments.find(a => a.doctorIds.includes(d.id));
                    return !assignment || !excludedWardIds.includes(assignment.wardId);
                })
                .map(d => ({
                    id: d.id,
                    hours: calculateTotalHours(d.id, period, currentShifts)
                })).sort((a, b) => b.hours - a.hours);

            if (stats.length < 2) break; // Need at least 2 people to balance

            const maxDoc = stats[0];
            const minDoc = stats[stats.length - 1];

            if (maxDoc.hours - minDoc.hours <= 12) break;

            // 2. Find an ER call to move
            const erShifts = currentShifts.filter(s => s.period === period && s.doctorId === maxDoc.id && s.wardId.startsWith('er-'));
            let swapped = false;

            for (const shift of erShifts) {
                const isConflict = currentShifts.some(s => s.period === period && s.doctorId === minDoc.id && s.day === shift.day);
                if (!isConflict) {
                    currentShifts = currentShifts.map(s => s.id === shift.id ? { ...s, doctorId: minDoc.id } : s);
                    swapped = true;
                    break;
                }
            }

            if (!swapped) break; // No possible swaps left
            iterations++;
        }

        await fetch('/api/shifts', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(currentShifts) 
        });

        setData(prev => ({ ...prev, shifts: currentShifts }));
        return true;
    } catch (e) { 
        alert('Auto-balance failed.'); 
        return false;
    } finally { 
        setSyncing(false); 
    }
  }, [data, calculateTotalHours]);

  const batchUpdateHistory = useCallback(async (period: string, action: 'add' | 'remove') => {
    setSyncing(true);
    try {
        const periodAssignments = data.assignments.filter(a => a.period === period);
        let updatedDocs: Doctor[] = [];
        
        data.doctors.forEach(d => {
            const assignment = periodAssignments.find(a => a.doctorIds.includes(d.id));
            if (!assignment) return;
            
            const wardId = assignment.wardId;
            let history = [...d.previousWards];
            
            if (action === 'add') {
                if (!history.includes(wardId)) {
                    history.push(wardId);
                    updatedDocs.push({ ...d, previousWards: history });
                }
            } else {
                if (history.includes(wardId)) {
                    history = history.filter(id => id !== wardId);
                    updatedDocs.push({ ...d, previousWards: history });
                }
            }
        });

        if (updatedDocs.length > 0) {
            await fetch('/api/import', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ doctors: updatedDocs }) 
            });
            setData(prev => ({
                ...prev,
                doctors: prev.doctors.map(d => updatedDocs.find(ud => ud.id === d.id) || d)
            }));
            alert(`History updated for ${updatedDocs.length} clinicians.`);
        } else {
            alert('No changes needed.');
        }
    } catch (e) { alert('History update failed.'); } finally { setSyncing(false); }
  }, [data]);

  return { ...data, loading, syncing, erConfig, updateERConfig, addDoctor, deleteDoctor, updateDoctor, addWard, deleteWard, updateWard, generateMonthlyDispatch, calculateDailyRoster, calculateERCalls, clearRosterByPeriod, deleteDispatchByPeriod, updateAssignment, swapPoolDoctors, swapShiftDoctors, importData, doctorMap, wardMap, calculateTotalHours, manualAssignDoctor, autoBalanceWorkload, batchUpdateHistory };
}
