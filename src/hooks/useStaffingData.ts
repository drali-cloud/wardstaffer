import { useState, useEffect, useCallback, useMemo } from 'react';
import { Doctor, Ward, Assignment, Gender, ShiftRecord, AuditLog } from '../types';

interface StaffingData {
  doctors: Doctor[];
  wards: Ward[];
  assignments: Assignment[];
  shifts: ShiftRecord[];
  logs: AuditLog[];
}

export function useStaffingData() {
  const [data, setData] = useState<StaffingData>({ doctors: [], wards: [], assignments: [], shifts: [], logs: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [erConfig, setErConfig] = useState<{ men: string[], women: string[], pediatric: string[], slots?: any, durations?: any, slotLabels?: any, fatigueGap?: number, balanceThreshold?: number, referralMaleOnly?: boolean }>({ men: [], women: [], pediatric: [] });

  const allWards = useMemo(() => {
    return [
      ...data.wards,
      {
        id: 'referral',
        name: 'Daily Referral',
        requirements: { totalDoctors: 0, genderDiversity: 'Specific', requiredMale: 1, requiredFemale: 0, shiftDuration: '24h', staffPerShift: 1 },
        hiddenFromCalendar: false
      }
    ] as Ward[];
  }, [data.wards]);

  const doctorMap = useMemo(() => new Map(data.doctors.map(d => [d.id, d])), [data.doctors]);
  const wardMap = useMemo(() => new Map(allWards.map(w => [w.id, w])), [allWards]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsResp, wardsResp, assignmentsResp, shiftsResp, configResp, logsResp] = await Promise.all([
        fetch('/api/doctors'), fetch('/api/wards'), fetch('/api/assignments'), fetch('/api/shifts'), fetch('/api/config'), fetch('/api/logs')
      ]);
      if (!docsResp.ok) throw new Error('Sync failed.');
      const [doctors, wards, assignments, shifts, config, logs] = await Promise.all([
        docsResp.json(), wardsResp.json(), assignmentsResp.json(), shiftsResp.json(), configResp.json(), logsResp.json()
      ]);
      setData({ 
          doctors: doctors || [], 
          wards: wards || [], 
          assignments: assignments || [], 
          shifts: shifts || [],
          logs: logs || []
      });
      setErConfig(config || { men: [], women: [], pediatric: [] });
    } catch (e) { console.error('Fetch error:', e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const updateERConfig = useCallback(async (newConfig: any) => {
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
    const durations = erConfig.durations || { referral: 24, men: 6, women: 6, pediatric: 8 };
    return shiftsToUse
        .filter(s => s.doctorId === doctorId && (!period || s.period === period))
        .reduce((total, s) => {
            if (s.wardId === 'referral') return total + (durations.referral ?? 24);
            if (s.wardId === 'er-men') return total + (durations.men ?? 6);
            if (s.wardId === 'er-women') return total + (durations.women ?? 6);
            if (s.wardId === 'er-pediatric') return total + (durations.pediatric ?? 8);
            if (s.wardId.startsWith('er-')) return total + 12;
            
            const ward = data.wards.find(w => w.id === s.wardId);
            if (ward?.requirements?.shiftWeight !== undefined) return total + ward.requirements.shiftWeight;
            const duration = ward?.requirements?.shiftDuration;
            if (duration === '6h') return total + 6;
            if (duration === '12h') return total + 12;
            return total + 24;
        }, 0);
  }, [data.shifts, data.wards, erConfig.durations]);

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

              // Track shift counts to ensure absolute equality within the month
              const shiftCounts: Record<string, number> = {};
              combinedDoctorPool.forEach(id => shiftCounts[id] = 0);
              let lastDayAssigned = new Set<string>();

              for (let day = 1; day <= daysInMonth; day++) {
                  const todayAssigned = new Set<string>();
                  for (let slot = 0; slot < totalDailySlots; slot++) {
                      // SELECTION CRITERIA:
                      // 1. Must not have worked earlier today
                      // 2. Must not have worked yesterday (12h-24h Rest Period Guard)
                      // 3. Must be the person with the LEAST shifts assigned so far this month
                      
                      let eligible = combinedDoctorPool.filter(id => !todayAssigned.has(id) && !lastDayAssigned.has(id));
                      
                      // EMERGENCY FALLBACK: If pool is too small for rest rules, just avoid same-day double shifts
                      if (eligible.length === 0) {
                          eligible = combinedDoctorPool.filter(id => !todayAssigned.has(id));
                      }
                      
                      // CRITICAL FALLBACK: If everyone is already working today, allow anyone
                      if (eligible.length === 0) eligible = combinedDoctorPool;

                      // SORT BY LEAST SHIFTS: Pick the person with the lowest count to maintain perfect equality
                      eligible.sort((a, b) => shiftCounts[a] - shiftCounts[b]);
                      
                      const dId = eligible[0];
                      shiftCounts[dId]++;
                      
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

  const calculateERCalls = useCallback(async (period: string, config: any) => {
    setSyncing(true);
    try {
        const daysInMonth = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).getDate();
        const wardShifts = data.shifts.filter(s => s.period === period);
        const newERShifts: ShiftRecord[] = [];
        
        const slots = config.slots || { referral: [1], men: [2, 4, 4, 2], women: [2, 4, 4, 2], pediatric: [1, 1, 1] };
        const durations = config.durations || { referral: 24, men: 6, women: 6, pediatric: 8 };
        const fatigueGap = config.fatigueGap ?? 12;
        const referralMaleOnly = config.referralMaleOnly !== false; // default true
        
        const categories = [
            { id: 'referral', name: 'Daily Referral', slots: slots.referral, wards: [...config.men, ...config.women, ...config.pediatric], duration: durations.referral ?? 24, maleOnly: referralMaleOnly },
            { id: 'er-men', name: 'Men', slots: slots.men, wards: config.men, duration: durations.men ?? 6 },
            { id: 'er-women', name: 'Women', slots: slots.women, wards: config.women, duration: durations.women ?? 6 },
            { id: 'er-pediatric', name: 'Pediatric', slots: slots.pediatric, wards: config.pediatric, duration: durations.pediatric ?? 8 }
        ];

        // Track cumulative hours per doctor for the period, starting with ward shifts
        const hoursMap: Record<string, number> = {};
        data.doctors.forEach(d => {
            hoursMap[d.id] = calculateTotalHours(d.id, period, wardShifts);
        });

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

                        // --- Slot time boundaries (hours from day midnight) ---
                        // Slot 0: 08:00-14:00  Slot 1: 14:00-20:00
                        // Slot 2: 20:00-02:00  Slot 3: 02:00-08:00
                        const SLOT_START = [8, 14, 20, 26]; // 26 = 02:00 next-day
                        const SLOT_END   = [14, 20, 26, 32]; // 32 = 08:00 next-day

                        // Helper: does yesterday's ER shift violate 12h rest before today's slotIdx?
                        const hasERConflictYesterday = (candidate: string): boolean => {
                            return newERShifts.some(prev => {
                                if (prev.day !== day - 1 || prev.doctorId !== candidate) return false;
                                const prevEndHour = SLOT_END[prev.slotIndex ?? 0] ?? 24;
                                const todayStartHour = SLOT_START[slotIdx] ?? 8;
                                const gap = (todayStartHour + 24) - prevEndHour;
                                return gap < fatigueGap;
                            });
                        };

                        // Pass 1: Strict (ward 12h rest + ER cross-day 12h rest)
                        let eligible = poolArray
                            .filter(candidate => {
                                const doc = doctorMap.get(candidate);
                                if (cat.maleOnly && doc?.gender !== 'Male') return false;

                                const hasWardShiftToday     = wardShifts.some(x => x.day === day     && x.doctorId === candidate);
                                const hasWardShiftYesterday = wardShifts.some(x => x.day === day - 1 && x.doctorId === candidate);
                                const hasWardShiftTomorrow  = wardShifts.some(x => x.day === day + 1 && x.doctorId === candidate);
                                const hasOtherERToday       = newERShifts.some(x => x.day === day     && x.doctorId === candidate);

                                // Ward-to-ER 12h rule (existing)
                                const isNightCall = slotIdx >= 2;
                                const yesterdayWardConflict = hasWardShiftYesterday && !isNightCall;
                                const tomorrowWardConflict  = hasWardShiftTomorrow  && isNightCall;

                                // NEW: ER-to-ER cross-day 12h rule
                                const erCrossConflict = hasERConflictYesterday(candidate);

                                return !hasWardShiftToday && !yesterdayWardConflict && !tomorrowWardConflict && !hasOtherERToday && !erCrossConflict;
                            })
                            .sort((a, b) => hoursMap[a] - hoursMap[b]);

                        // Pass 2: Relaxed — keep ER cross-day rule but drop ward-rest rules
                        if (eligible.length === 0) {
                            eligible = poolArray
                                .filter(candidate => {
                                    const doc = doctorMap.get(candidate);
                                    if (cat.maleOnly && doc?.gender !== 'Male') return false;

                                    const hasWardShiftToday = wardShifts.some(x => x.day === day && x.doctorId === candidate);
                                    const hasOtherERToday   = newERShifts.some(x => x.day === day && x.doctorId === candidate);
                                    const erCrossConflict   = hasERConflictYesterday(candidate);

                                    return !hasWardShiftToday && !hasOtherERToday && !erCrossConflict;
                                })
                                .sort((a, b) => hoursMap[a] - hoursMap[b]);
                        }

                        // Pass 3: Last-resort fallback — only same-day conflicts blocked
                        if (eligible.length === 0) {
                            eligible = poolArray
                                .filter(candidate => {
                                    const doc = doctorMap.get(candidate);
                                    if (cat.maleOnly && doc?.gender !== 'Male') return false;
                                    return !newERShifts.some(x => x.day === day && x.doctorId === candidate);
                                })
                                .sort((a, b) => hoursMap[a] - hoursMap[b]);
                        }

                        if (eligible.length > 0) {
                            const dId = eligible[0];
                            newERShifts.push({
                                id: `er-${period}-${day}-${cat.id}-${slotIdx}-${s}`,
                                period, day, wardId: cat.id, doctorId: dId, slotIndex: slotIdx
                            });
                            hoursMap[dId] += cat.duration;
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
        const SLOT_START = [8, 14, 20, 26]; 
        const SLOT_END   = [14, 20, 26, 32];
        const fatigueGap = erConfig.fatigueGap ?? 12;
        const balanceThreshold = erConfig.balanceThreshold ?? 12;

        const canTakeShift = (doctorId: string, shift: ShiftRecord, shifts: ShiftRecord[]): boolean => {
            const doctorShifts = shifts.filter(s => s.period === period && s.doctorId === doctorId && s.id !== shift.id);
            const isNightER = (shift.slotIndex ?? 0) >= 2;
            const isWardShift = !shift.wardId.startsWith('er-');
            const shiftStart = SLOT_START[shift.slotIndex ?? 0] ?? 8;
            const shiftEnd   = SLOT_END[shift.slotIndex ?? 0] ?? 24;

            for (const s of doctorShifts) {
                if (s.day === shift.day) return false;

                // Cross-day ER rest rule (configurable fatigue gap)
                if (s.wardId.startsWith('er-') && s.day === shift.day - 1) {
                    const prevEnd = SLOT_END[s.slotIndex ?? 0] ?? 24;
                    if ((shiftStart + 24) - prevEnd < fatigueGap) return false;
                }
                if (s.wardId.startsWith('er-') && s.day === shift.day + 1) {
                    const nextStart = SLOT_START[s.slotIndex ?? 0] ?? 8;
                    if ((nextStart + 24) - shiftEnd < fatigueGap) return false;
                }

                // Ward-to-ER fatigue rules
                if (isWardShift) {
                    if (s.wardId.startsWith('er-') && s.day === shift.day - 1 && (s.slotIndex ?? 0) >= 2) return false;
                } else {
                    if (!s.wardId.startsWith('er-') && s.day === shift.day - 1 && !isNightER) return false;
                    if (!s.wardId.startsWith('er-') && s.day === shift.day + 1 && isNightER) return false;
                }
            }
            return true;
        };

        // ─── Duration helper (uses configurable erConfig.durations) ────────────
        const getDuration = (s: ShiftRecord): number => {
            const durations = erConfig.durations || { referral: 24, men: 6, women: 6, pediatric: 8 };
            if (s.wardId === 'referral')     return durations.referral ?? 24;
            if (s.wardId === 'er-men')       return durations.men ?? 6;
            if (s.wardId === 'er-women')     return durations.women ?? 6;
            if (s.wardId === 'er-pediatric') return durations.pediatric ?? 8;
            return 12;
        };

        // --- PHASE 1: Intra-Ward Balance (Ward Shifts Only) ---
        const periodAssignments = data.assignments.filter(a => a.period === period);
        for (const assignment of periodAssignments) {
            let wardChanges = true;
            let wardIterations = 0;
            while (wardChanges && wardIterations < 100) {
                wardChanges = false;
                wardIterations++;

                const pool = assignment.doctorIds;
                const wardStats = pool.map(id => ({
                    id,
                    count: currentShifts.filter(s => s.period === period && s.doctorId === id && s.wardId === assignment.wardId).length
                })).sort((a, b) => b.count - a.count);

                if (wardStats.length < 2) break;
                const max = wardStats[0];
                const min = wardStats[wardStats.length - 1];

                if (max.count - min.count > 1) {
                    const candidates = currentShifts.filter(s => s.period === period && s.doctorId === max.id && s.wardId === assignment.wardId);
                    for (const s of candidates) {
                        if (canTakeShift(min.id, s, currentShifts)) {
                            currentShifts = currentShifts.map(x => x.id === s.id ? { ...x, doctorId: min.id } : x);
                            wardChanges = true;
                            break;
                        }
                    }
                }
            }
        }

        // ─── PHASE 2: Global ER + Referral Equity — Best-Move Exhaustive Search ──
        //
        // Algorithm per iteration:
        //   1. Sort all active doctors by total hours (desc).
        //   2. For every (rich, poor) pair where gap > balanceThreshold:
        //        a. MOVE  – try giving any of rich's ER shifts to poor.
        //        b. SWAP  – try exchanging any two ER shifts of differing duration.
        //   3. Apply the single move that achieves the GREATEST gap reduction.
        //   4. Repeat until no move improves equity or threshold is reached.
        //
        // Key improvements over old algorithm:
        //   - Scans ALL pairs, not just top-5 / bottom-5.
        //   - Picks BEST move per iteration, not first valid move.
        //   - Prevents overshoot (poor becoming richer than rich after move).
        //   - Uses configurable fatigueGap and balanceThreshold.
        //   - Tries all swap directions, not just referral↔small.

        let iterations = 0;
        let improved = true;

        while (improved && iterations < 2000) {
            improved = false;
            iterations++;

            const leaderboard = data.doctors
                .filter(d => d.id !== 'root')
                .map(d => {
                    const asgn = data.assignments.find(a => a.period === period && a.doctorIds.includes(d.id));
                    return {
                        id: d.id,
                        gender: d.gender as string,
                        hours: calculateTotalHours(d.id, period, currentShifts),
                        isExcluded: !!(asgn && excludedWardIds.includes(asgn.wardId))
                    };
                })
                .filter(d => !d.isExcluded)
                .sort((a, b) => b.hours - a.hours);

            if (leaderboard.length < 2) break;
            const maxHours = leaderboard[0].hours;
            const minHours = leaderboard[leaderboard.length - 1].hours;
            if (maxHours - minHours <= balanceThreshold) break;

            let bestReduction = 0;
            let bestMove: { type: 'move' | 'swap', shiftId: string, otherShiftId?: string, toDocId: string } | null = null;

            for (let i = 0; i < leaderboard.length; i++) {
                const rich = leaderboard[i];
                if (rich.hours - minHours <= balanceThreshold) break; // All remaining are close enough

                const richER = currentShifts.filter(s =>
                    s.period === period && s.doctorId === rich.id && s.wardId.startsWith('er-')
                );
                if (richER.length === 0) continue;

                for (let j = leaderboard.length - 1; j > i; j--) {
                    const poor = leaderboard[j];
                    const gap = rich.hours - poor.hours;
                    if (gap <= balanceThreshold) break; // inner loop can also stop early

                    const poorER = currentShifts.filter(s =>
                        s.period === period && s.doctorId === poor.id && s.wardId.startsWith('er-')
                    );

                    // A. MOVE: give one of rich's ER shifts to poor
                    for (const s of richER) {
                        if (s.wardId === 'referral' && poor.gender !== 'Male') continue;
                        if (!canTakeShift(poor.id, s, currentShifts)) continue;

                        const dur = getDuration(s);
                        const newRich = rich.hours - dur;
                        const newPoor = poor.hours + dur;
                        if (newPoor > newRich) continue; // overshoot guard

                        const reduction = gap - (newRich - newPoor);
                        if (reduction > bestReduction) {
                            bestReduction = reduction;
                            bestMove = { type: 'move', shiftId: s.id, toDocId: poor.id };
                        }
                    }

                    // B. SWAP: exchange two ER shifts of different duration
                    for (const richShift of richER) {
                        const richDur = getDuration(richShift);
                        for (const poorShift of poorER) {
                            const poorDur = getDuration(poorShift);
                            if (richDur <= poorDur) continue; // swap must move hours from rich → poor

                            if (richShift.wardId === 'referral' && poor.gender !== 'Male') continue;
                            if (poorShift.wardId === 'referral' && rich.gender !== 'Male') continue;

                            const tempShifts = currentShifts.filter(s => s.id !== richShift.id && s.id !== poorShift.id);
                            if (!canTakeShift(poor.id, richShift, tempShifts)) continue;
                            if (!canTakeShift(rich.id, poorShift, tempShifts)) continue;

                            const newRich = rich.hours - richDur + poorDur;
                            const newPoor = poor.hours + richDur - poorDur;
                            if (newPoor > newRich) continue; // overshoot guard

                            const reduction = gap - (newRich - newPoor);
                            if (reduction > bestReduction) {
                                bestReduction = reduction;
                                bestMove = { type: 'swap', shiftId: richShift.id, otherShiftId: poorShift.id, toDocId: poor.id };
                            }
                        }
                    }
                }
            }

            if (bestMove && bestReduction > 0) {
                if (bestMove.type === 'move') {
                    currentShifts = currentShifts.map(s =>
                        s.id === bestMove!.shiftId ? { ...s, doctorId: bestMove!.toDocId } : s
                    );
                } else {
                    const fromDocId = currentShifts.find(s => s.id === bestMove!.shiftId)?.doctorId ?? '';
                    currentShifts = currentShifts.map(s => {
                        if (s.id === bestMove!.shiftId)      return { ...s, doctorId: bestMove!.toDocId };
                        if (s.id === bestMove!.otherShiftId) return { ...s, doctorId: fromDocId };
                        return s;
                    });
                }
                improved = true;
            }
        }

        // Final stats
        const finalHours = data.doctors
            .filter(d => d.id !== 'root')
            .map(d => calculateTotalHours(d.id, period, currentShifts));
        const finalMax = Math.max(...finalHours);
        const finalMin = Math.min(...finalHours);
        const finalGap = finalMax - finalMin;

        await fetch('/api/shifts', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(currentShifts.filter(s => s.period === period)) 
        });

        setData(prev => ({ ...prev, shifts: currentShifts }));
        await addLog('auto_balance', `Equity engine: ${iterations} iterations. Final gap: ${finalGap}h (max ${finalMax}h / min ${finalMin}h).`, period);
        alert(`Workload balanced in ${iterations} iterations.\nMax: ${finalMax}h | Min: ${finalMin}h | Gap: ${finalGap}h`);
        return true;
    } catch (e) {
        console.error('Auto-balance failed:', e);
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


  const addLog = useCallback(async (action: string, details: string, period: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      action: action as any,
      details,
      period
    };
    try {
        await fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLog) });
        setData(prev => ({ ...prev, logs: [newLog, ...prev.logs] }));
    } catch (e) { console.error('Log failure:', e); }
  }, []);

  const optimizeReferralsForMales = useCallback(async (period: string) => {
    setSyncing(true);
    try {
        let currentShifts = [...data.shifts];
        const maleDoctors = data.doctors.filter(d => d.gender === 'Male' && d.id !== 'root');
        const referralShifts = currentShifts.filter(s => s.period === period && s.wardId === 'referral');

        for (const shift of referralShifts) {
            const stats = maleDoctors.map(d => ({
                id: d.id,
                hours: calculateTotalHours(d.id, period, currentShifts)
            })).sort((a, b) => a.hours - b.hours);

            for (const candidate of stats) {
                const isConflict = currentShifts.some(s => s.period === period && s.doctorId === candidate.id && s.day === shift.day);
                if (!isConflict) {
                    currentShifts = currentShifts.map(s => s.id === shift.id ? { ...s, doctorId: candidate.id } : s);
                    break;
                }
            }
        }

        await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentShifts) });
        setData(prev => ({ ...prev, shifts: currentShifts }));
        await addLog('auto_balance', `Rearranged male referrals to equalize hours`, period);
    } catch (e) { alert('Referral optimization failed.'); } finally { setSyncing(false); }
  }, [data, calculateTotalHours, addLog]);

  const swapERCalls = useCallback(async (period: string, shiftA: ShiftRecord, shiftB: ShiftRecord) => {
    setSyncing(true);
    try {
        const newS1 = { ...shiftA, doctorId: shiftB.doctorId };
        const newS2 = { ...shiftB, doctorId: shiftA.doctorId };
        
        const docAName = doctorMap.get(shiftA.doctorId)?.name || 'Unknown';
        const docBName = doctorMap.get(shiftB.doctorId)?.name || 'Unknown';
        const wardAName = wardMap.get(shiftA.wardId)?.name || shiftA.wardId;
        const wardBName = wardMap.get(shiftB.wardId)?.name || shiftB.wardId;

        await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([newS1, newS2])
        });

        await addLog('swap_er', 
            `Swapped ${docAName} (${wardAName} Day ${shiftA.day}) with ${docBName} (${wardBName} Day ${shiftB.day})`, 
            period
        );

        setData(prev => ({
            ...prev,
            shifts: prev.shifts.map(s => s.id === shiftA.id ? newS1 : s.id === shiftB.id ? newS2 : s)
        }));
    } catch (e) { alert('Swap failed.'); } finally { setSyncing(false); }
  }, [data.shifts, doctorMap, wardMap, addLog]);

  const resolveFatigueConflict = useCallback(async (period: string, shiftId: string) => {
    setSyncing(true);
    try {
        const shiftA = data.shifts.find(s => s.id === shiftId);
        if (!shiftA) return;
        const docA = shiftA.doctorId;
        let currentShifts = [...data.shifts];

        const candidates = currentShifts.filter(s => 
            s.period === period && 
            s.wardId.startsWith('er-') && 
            s.doctorId !== docA && 
            s.day !== shiftA.day
        );

        const SLOT_START = [8, 14, 20, 26]; 
        const SLOT_END   = [14, 20, 26, 32];

        const checkSafe12h = (dId: string, targetShift: ShiftRecord, excludeId: string) => {
            let targetStart = (targetShift.day - 1) * 24 + (SLOT_START[targetShift.slotIndex ?? 0] ?? 8);
            let targetEnd = (targetShift.day - 1) * 24 + (SLOT_END[targetShift.slotIndex ?? 0] ?? 24);

            if (!targetShift.wardId.startsWith('er-') && targetShift.slotIndex === undefined) {
                const ward = wardMap.get(targetShift.wardId);
                const duration = ward?.requirements?.shiftDuration === '6h' ? 6 : ward?.requirements?.shiftDuration === '12h' ? 12 : 24;
                targetEnd = targetStart + duration;
            }

            return !currentShifts.some(s => {
                if (s.period !== period || s.doctorId !== dId || s.id === excludeId) return false;
                
                let sStart = (s.day - 1) * 24 + (SLOT_START[s.slotIndex ?? 0] ?? 8);
                let sEnd = (s.day - 1) * 24 + (SLOT_END[s.slotIndex ?? 0] ?? 24);

                if (!s.wardId.startsWith('er-') && s.slotIndex === undefined) {
                    const ward = wardMap.get(s.wardId);
                    const duration = ward?.requirements?.shiftDuration === '6h' ? 6 : ward?.requirements?.shiftDuration === '12h' ? 12 : 24;
                    sEnd = sStart + duration;
                }

                const gap = Math.max(targetStart - sEnd, sStart - targetEnd);
                return gap < 12;
            });
        };

        for (const shiftB of candidates) {
            const docB = shiftB.doctorId;
            if (checkSafe12h(docA, shiftB, shiftA.id) && checkSafe12h(docB, shiftA, shiftB.id)) {
                const newS1 = { ...shiftA, doctorId: docB };
                const newS2 = { ...shiftB, doctorId: docA };
                await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([newS1, newS2]) });
                setData(prev => ({ ...prev, shifts: prev.shifts.map(s => s.id === shiftA.id ? newS1 : s.id === shiftB.id ? newS2 : s) }));
                await addLog('auto_resolve', `Resolved fatigue for ${doctorMap.get(docA)?.name} by swapping with ${doctorMap.get(docB)?.name}`, period);
                alert('Fatigue resolved with 12h safety margin.');
                return;
            }
        }
        alert('No 12h safe swap candidates found.');
    } catch (e) { console.error(e); } finally { setSyncing(false); }
  }, [data.shifts, doctorMap, wardMap, addLog]);

  return { ...data, wards: allWards, loading, syncing, erConfig, updateERConfig, addDoctor, deleteDoctor, updateDoctor, addWard, deleteWard, updateWard, generateMonthlyDispatch, calculateDailyRoster, calculateERCalls, clearRosterByPeriod, deleteDispatchByPeriod, updateAssignment, swapPoolDoctors, swapShiftDoctors, swapERCalls, optimizeReferralsForMales, importData, doctorMap, wardMap, calculateTotalHours, manualAssignDoctor, autoBalanceWorkload, batchUpdateHistory, resolveFatigueConflict };
}
