import { useState, useEffect, useCallback, useMemo } from 'react';
import { Doctor, Ward, Assignment, Gender, ShiftRecord, AuditLog, Team } from '../types';

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
  const [erConfig, setErConfig] = useState<{ men: string[], women: string[], pediatric: string[], slots?: any, durations?: any, slotLabels?: any, fatigueGap?: number, balanceThreshold?: number, referralMaleOnly?: boolean, referralBufferDays?: number }>({ men: [], women: [], pediatric: [] });
  const [teams, setTeams] = useState<Team[]>([]);

  const allWards = useMemo(() => {
    return [
      ...data.wards,
      { id: 'referral', name: 'Daily Referral', requirements: { totalDoctors: 0, genderDiversity: 'Specific', requiredMale: 1, requiredFemale: 0, shiftDuration: '24h', staffPerShift: 1 }, hiddenFromCalendar: false },
      { id: 'er-men', name: 'ER Men', requirements: { totalDoctors: 0, genderDiversity: 'Neutral', requiredMale: 0, requiredFemale: 0, shiftDuration: '6h', staffPerShift: 1 }, hiddenFromCalendar: false },
      { id: 'er-women', name: 'ER Women', requirements: { totalDoctors: 0, genderDiversity: 'Neutral', requiredMale: 0, requiredFemale: 0, shiftDuration: '6h', staffPerShift: 1 }, hiddenFromCalendar: false },
      { id: 'er-pediatric', name: 'ER Pediatric', requirements: { totalDoctors: 0, genderDiversity: 'Neutral', requiredMale: 0, requiredFemale: 0, shiftDuration: '8h', staffPerShift: 1 }, hiddenFromCalendar: false }
    ] as Ward[];
  }, [data.wards]);

  const doctorMap = useMemo(() => new Map(data.doctors.map(d => [d.id, d])), [data.doctors]);
  const wardMap = useMemo(() => new Map(allWards.map(w => [w.id, w])), [allWards]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsResp, wardsResp, assignmentsResp, shiftsResp, configResp, logsResp, teamsResp] = await Promise.all([
        fetch('/api/doctors'), fetch('/api/wards'), fetch('/api/assignments'), fetch('/api/shifts'), fetch('/api/config'), fetch('/api/logs'), fetch('/api/teams')
      ]);
      if (!docsResp.ok) throw new Error('Sync failed.');
      const [doctors, wards, assignments, shifts, config, logs, teamsData] = await Promise.all([
        docsResp.json(), wardsResp.json(), assignmentsResp.json(), shiftsResp.json(), configResp.json(), logsResp.json(), teamsResp.json()
      ]);
      setData({ 
          doctors: doctors || [], 
          wards: wards || [], 
          assignments: assignments || [], 
          shifts: shifts || [],
          logs: logs || []
      });
      setErConfig(config || { men: [], women: [], pediatric: [] });
      setTeams(teamsData || []);
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
            d.id !== 'root' &&
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

          // Build fast team-lookup: doctorId → Team (if any)
          const doctorTeamMap = new Map<string, Team>();
          teams.forEach(t => t.memberIds.forEach(id => doctorTeamMap.set(id, t)));

          for (const assignment of assignments) {
              const ward = data.wards.find(w => w.id === assignment.wardId);
              if (!ward) continue;
              if (ward.parentWardId) continue;

              const subordinates = data.wards.filter(w => w.parentWardId === ward.id);
              const subAssignments = assignments.filter(a => subordinates.some(s => s.id === a.wardId));
              const combinedDoctorPool = Array.from(new Set([...assignment.doctorIds, ...subAssignments.flatMap(a => a.doctorIds)]));
              
              if (combinedDoctorPool.length === 0) continue;

              const { staffPerShift, shiftDuration } = ward.requirements;
              const shiftsPerDay = shiftDuration === '6h' ? 4 : shiftDuration === '12h' ? 2 : 1;
              const totalDailySlots = shiftsPerDay * staffPerShift;

              const shiftCounts: Record<string, number> = {};
              combinedDoctorPool.forEach(id => shiftCounts[id] = 0);
              let lastDayAssigned = new Set<string>();

              for (let day = 1; day <= daysInMonth; day++) {
                  const todayAssigned = new Set<string>();

                  // Process slots in groups equal to staffPerShift so teams fill a slot together
                  for (let shiftIdx = 0; shiftIdx < shiftsPerDay; shiftIdx++) {
                      const slotBase = shiftIdx * staffPerShift;
                      // Doctors already placed in this time-slot (may be >1 if staffPerShift==2)
                      const slotMembers: string[] = [];

                      for (let pos = 0; pos < staffPerShift; pos++) {
                          const globalSlot = slotBase + pos;

                          // If a teammate was already placed in this slot position, fill remaining positions
                          if (slotMembers.length > 0) {
                              // Try to find a teammate of the already-placed member
                              const placedTeam = doctorTeamMap.get(slotMembers[0]);
                              if (placedTeam) {
                                  const teammate = placedTeam.memberIds.find(id =>
                                      id !== slotMembers[0] &&
                                      combinedDoctorPool.includes(id) &&
                                      !todayAssigned.has(id)
                                  );
                                  if (teammate) {
                                      slotMembers.push(teammate);
                                      todayAssigned.add(teammate);
                                      shiftCounts[teammate] = (shiftCounts[teammate] ?? 0) + 1;
                                      newShifts.push({
                                          id: `${period}-${day}-${ward.id}-${globalSlot}`,
                                          period, day, wardId: ward.id, slotIndex: globalSlot, doctorId: teammate
                                      });
                                      continue;
                                  }
                              }
                          }

                          // Standard eligible-pool selection
                          let eligible = combinedDoctorPool.filter(id => !todayAssigned.has(id) && !lastDayAssigned.has(id));
                          if (eligible.length === 0) eligible = combinedDoctorPool.filter(id => !todayAssigned.has(id));
                          if (eligible.length === 0) eligible = combinedDoctorPool;

                          eligible.sort((a, b) => {
                              const countDiff = shiftCounts[a] - shiftCounts[b];
                              if (countDiff !== 0) return countDiff;
                              const aScore = doctorMap.get(a)?.gender === 'Female' ? 0 : 1;
                              const bScore = doctorMap.get(b)?.gender === 'Female' ? 0 : 1;
                              return aScore - bScore;
                          });

                          const dId = eligible[0];
                          slotMembers.push(dId);
                          todayAssigned.add(dId);
                          shiftCounts[dId] = (shiftCounts[dId] ?? 0) + 1;
                          newShifts.push({
                              id: `${period}-${day}-${ward.id}-${globalSlot}`,
                              period, day, wardId: ward.id, slotIndex: globalSlot, doctorId: dId
                          });

                          // If this doctor is in a team AND staffPerShift has a next position,
                          // pre-fill it with a teammate (handled in next iteration's `slotMembers` check)
                      }
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
  }, [data.assignments, data.wards, wardMap, teams, doctorMap]);

  const clearRosterByPeriod = useCallback(async (period: string, type: 'all' | 'er' | 'ward' = 'all') => {
    if (!confirm(`Are you sure you want to delete ${type === 'all' ? 'ALL' : type.toUpperCase()} shifts for ${period}?`)) return;
    setSyncing(true);
    try {
        await fetch('/api/shifts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period, type }) });
        setData(prev => ({ 
            ...prev, 
            shifts: prev.shifts.filter(s => {
                if (s.period !== period) return true;
                if (type === 'er') return !(s.wardId.startsWith('er-') || s.wardId === 'referral');
                if (type === 'ward') return s.wardId.startsWith('er-') || s.wardId === 'referral';
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

  // One-way transfer: move docA from wardA → wardB without needing a swap partner.
  // Removes docA from the source assignment, adds to the target assignment,
  // and re-stamps all their ward shifts for this period to the target ward.
  const movePoolDoctor = useCallback(async (period: string, wardA: string, docA: string, wardB: string) => {
    if (wardA === wardB) return;
    setSyncing(true);
    try {
        const assignments = data.assignments.filter(a => a.period === period);
        const srcAssignment = assignments.find(a => a.wardId === wardA);
        const dstAssignment = assignments.find(a => a.wardId === wardB);
        if (!srcAssignment) return;

        // Remove doctor from source
        const newSrc = { ...srcAssignment, doctorIds: srcAssignment.doctorIds.filter(id => id !== docA) };
        // Add doctor to destination (create if not exists)
        const newDst = dstAssignment
            ? { ...dstAssignment, doctorIds: [...dstAssignment.doctorIds, docA] }
            : { id: `${period}-${wardB}`, period, wardId: wardB, doctorIds: [docA] };

        // Re-stamp all ward shifts for this doctor in this period to the target ward
        const updatedShifts = data.shifts.map(s => {
            if (s.period !== period || s.doctorId !== docA) return s;
            if (s.wardId === wardA) return { ...s, wardId: wardB };
            return s;
        });
        const shiftsToPersist = updatedShifts.filter(s => s.period === period && s.doctorId === docA);

        const requests: Promise<any>[] = [
            fetch(`/api/assignments/${newSrc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSrc) }),
            dstAssignment
                ? fetch(`/api/assignments/${newDst.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDst) })
                : fetch('/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDst) }).catch(() =>
                    fetch(`/api/assignments/${newDst.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDst) })
                ),
        ];
        if (shiftsToPersist.length > 0) {
            requests.push(fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shiftsToPersist) }));
        }
        await Promise.all(requests);

        setData(prev => ({
            ...prev,
            assignments: [
                ...prev.assignments.filter(a => a.id !== newSrc.id && a.id !== newDst.id),
                newSrc,
                newDst,
            ],
            shifts: updatedShifts,
        }));
    } catch (e) { alert('Transfer failed.'); } finally { setSyncing(false); }
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
        // IMPORTANT: Only consider WARD shifts for initial fatigue/availability checks.
        // We exclude existing er/referral shifts because we are about to replace them.
        const wardShifts = data.shifts.filter(s => s.period === period && !s.wardId.startsWith('er-') && s.wardId !== 'referral');
        const newERShifts: ShiftRecord[] = [];
        
        const slots = config.slots || { referral: [1], men: [2, 4, 4, 2], women: [2, 4, 4, 2], pediatric: [1, 1, 1] };
        const durations = config.durations || { referral: 24, men: 6, women: 6, pediatric: 8 };
        const fatigueGap = config.fatigueGap ?? 12;
        const referralMaleOnly = config.referralMaleOnly !== false;
        const referralBufferDays = config.referralBufferDays ?? 1;
        
        const categories = [
            { id: 'referral', name: 'Daily Referral', slots: slots.referral, wards: [...(config.men || []), ...(config.women || []), ...(config.pediatric || [])], duration: durations.referral ?? 24, maleOnly: referralMaleOnly },
            { id: 'er-men', name: 'Men', slots: slots.men, wards: config.men || [], duration: durations.men ?? 6 },
            { id: 'er-women', name: 'Women', slots: slots.women, wards: config.women || [], duration: durations.women ?? 6 },
            { id: 'er-pediatric', name: 'Pediatric', slots: slots.pediatric, wards: config.pediatric || [], duration: durations.pediatric ?? 8 }
        ];

        const hoursMap: Record<string, number> = {};
        const erCallCount: Record<string, number> = {};
        const referralCount: Record<string, number> = {};
        data.doctors.filter(d => d.id !== 'root').forEach(d => {
            hoursMap[d.id]      = calculateTotalHours(d.id, period, wardShifts);
            erCallCount[d.id]   = 0;
            referralCount[d.id] = 0;
        });

        const ER_CALL_HARD_CAP = 11;
        const deactivatedDays = config.deactivatedDays?.[period] || [];

        for (let day = 1; day <= daysInMonth; day++) {
            if (deactivatedDays.includes(day)) continue;
            
            categories.forEach(cat => {
                const pool = new Set<string>();
                cat.wards.forEach(wId => {
                    const assignment = data.assignments.find(a => a.period === period && a.wardId === wId);
                    assignment?.doctorIds.forEach(dId => pool.add(dId));
                });
                
                const poolArray = Array.from(pool);
                if (poolArray.length === 0) return;

                cat.slots.forEach((staffCount, slotIdx) => {
                    const slotDuration = cat.duration;
                    const slotStartHour = 8 + (slotIdx * slotDuration);
                    const slotEndHour = slotStartHour + slotDuration;

                    for (let s = 0; s < staffCount; s++) {
                        const hasERConflictYesterday = (candidate: string): boolean => {
                            return newERShifts.some(prev => {
                                if (prev.day !== day - 1 || prev.doctorId !== candidate) return false;
                                const prevCat = categories.find(c => c.id === prev.wardId);
                                const prevDuration = prevCat?.duration || 6;
                                const prevEnd = 8 + ((prev.slotIndex || 0) * prevDuration);
                                const prevEndAbsolute = prevEnd + prevDuration;
                                const gap = (slotStartHour + 24) - prevEndAbsolute;
                                return gap < fatigueGap;
                            });
                        };

                        const hasReferralBufferConflict = (candidate: string): boolean => {
                            if (cat.id !== 'referral') return false;
                            const allDayShifts = [
                                ...wardShifts.filter(x => x.doctorId === candidate),
                                ...newERShifts.filter(x => x.doctorId === candidate)
                            ];
                            for (let offset = 1; offset <= referralBufferDays; offset++) {
                                if (allDayShifts.some(x => x.day === day - offset || x.day === day + offset)) return true;
                            }
                            return false;
                        };

                        const sortKey = (id: string) =>
                            cat.id === 'referral' ? referralCount[id] ?? 0 : erCallCount[id] ?? 0;

                        const underHardCap = (id: string) =>
                            cat.id === 'referral' || (erCallCount[id] ?? 0) < ER_CALL_HARD_CAP;

                        // Pass 1: Strict
                        let eligible = poolArray
                            .filter(candidate => {
                                const doc = doctorMap.get(candidate);
                                if (cat.maleOnly && doc?.gender !== 'Male') return false;
                                if (!underHardCap(candidate)) return false;

                                const hasWardShiftToday     = wardShifts.some(x => x.day === day     && x.doctorId === candidate);
                                const hasWardShiftYesterday = wardShifts.some(x => x.day === day - 1 && x.doctorId === candidate);
                                const hasWardShiftTomorrow  = wardShifts.some(x => x.day === day + 1 && x.doctorId === candidate);
                                const hasOtherERToday       = newERShifts.some(x => x.day === day     && x.doctorId === candidate);

                                const isNightCall = slotStartHour >= 20;
                                const yesterdayWardConflict = hasWardShiftYesterday && !isNightCall;
                                const tomorrowWardConflict  = hasWardShiftTomorrow  && isNightCall;

                                const erCrossConflict = hasERConflictYesterday(candidate);
                                const refBufferConflict = hasReferralBufferConflict(candidate);

                                return !hasWardShiftToday && !yesterdayWardConflict && !tomorrowWardConflict && !hasOtherERToday && !erCrossConflict && !refBufferConflict;
                            })
                            .sort((a, b) => sortKey(a) - sortKey(b));

                        // Pass 2: Relaxed
                        if (eligible.length === 0) {
                            eligible = poolArray
                                .filter(candidate => {
                                    const doc = doctorMap.get(candidate);
                                    if (cat.maleOnly && doc?.gender !== 'Male') return false;
                                    if (!underHardCap(candidate)) return false;

                                    const hasWardShiftToday = wardShifts.some(x => x.day === day && x.doctorId === candidate);
                                    const hasOtherERToday   = newERShifts.some(x => x.day === day && x.doctorId === candidate);
                                    const erCrossConflict   = hasERConflictYesterday(candidate);
                                    const refBufferConflict = hasReferralBufferConflict(candidate);

                                    return !hasWardShiftToday && !hasOtherERToday && !erCrossConflict && !refBufferConflict;
                                })
                                .sort((a, b) => sortKey(a) - sortKey(b));
                        }

                        // Pass 3: Last-resort
                        if (eligible.length === 0) {
                            eligible = poolArray
                                .filter(candidate => {
                                    const doc = doctorMap.get(candidate);
                                    if (cat.maleOnly && doc?.gender !== 'Male') return false;
                                    const sameDay = newERShifts.some(x => x.day === day && x.doctorId === candidate);
                                    const refBufferConflict = hasReferralBufferConflict(candidate);
                                    return !sameDay && !refBufferConflict;
                                })
                                .sort((a, b) => sortKey(a) - sortKey(b));
                        }

                        if (eligible.length > 0) {
                            const dId = eligible[0];
                            newERShifts.push({
                                id: `er-${period}-${day}-${cat.id}-${slotIdx}-${s}`,
                                period, day, wardId: cat.id, doctorId: dId, slotIndex: slotIdx
                            });
                            hoursMap[dId] += cat.duration;
                            if (cat.id === 'referral') {
                                referralCount[dId] = (referralCount[dId] ?? 0) + 1;
                            } else {
                                erCallCount[dId] = (erCallCount[dId] ?? 0) + 1;
                            }
                        }
                    }
                });
            });
        }

        const delResp = await fetch('/api/shifts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period, type: 'er' })
        });
        if (!delResp.ok) throw new Error('Failed to clear old ER shifts from database');

        const saveResp = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newERShifts) });
        if (!saveResp.ok) throw new Error('Failed to save ER shifts to database');

        setData(prev => ({ ...prev, shifts: [...prev.shifts.filter(s => !(s.period === period && (s.wardId.startsWith('er-') || s.wardId === 'referral'))), ...newERShifts] }));
    } catch (e: any) { alert(`ER calculation failed: ${e.message}`); } finally { setSyncing(false); }
  }, [data.shifts, data.assignments, data.doctors, doctorMap, calculateTotalHours]);

  const calculateTeamRoundRobinERCalls = useCallback(async (period: string) => {
    setSyncing(true);
    try {
        if (teams.length === 0) { alert('No teams found. Define teams in Staff Registry first.'); return; }
        
        const daysInMonth = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).getDate();
        const config = erConfig;
        const deactivatedDays = config.deactivatedDays?.[period] || [];
        
        const slots = config.slots || { referral: [1], men: [2, 4, 4, 2], women: [2, 4, 4, 2], pediatric: [1, 1, 1] };
        
        const categories = [
            { id: 'referral', slots: slots.referral },
            { id: 'er-men', slots: slots.men },
            { id: 'er-women', slots: slots.women },
            { id: 'er-pediatric', slots: slots.pediatric }
        ];

        const newERShifts: ShiftRecord[] = [];
        const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        let activeDayIndex = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            if (deactivatedDays.includes(day)) continue;

            const teamIndex = activeDayIndex % sortedTeams.length;
            const selectedTeam = sortedTeams[teamIndex];
            const members = [...selectedTeam.memberIds];
            
            if (members.length === 0) {
                activeDayIndex++; // Move to next team if this one is empty? Or just skip? 
                // Skip is safer to not lose a day for a valid team.
                continue; 
            }
            activeDayIndex++;

            let memberIdx = 0;
            categories.forEach(cat => {
                cat.slots.forEach((staffCount, slotIdx) => {
                    for (let s = 0; s < staffCount; s++) {
                        const dId = members[memberIdx % members.length];
                        newERShifts.push({
                            id: `er-team-${period}-${day}-${cat.id}-${slotIdx}-${s}`,
                            period, day, wardId: cat.id, doctorId: dId, slotIndex: slotIdx
                        });
                        memberIdx++;
                    }
                });
            });
        }

        const delResp = await fetch('/api/shifts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period, type: 'er' })
        });
        if (!delResp.ok) throw new Error('Failed to clear old shifts');

        const saveResp = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newERShifts) });
        if (!saveResp.ok) throw new Error('Failed to save roster');

        setData(prev => ({ ...prev, shifts: [...prev.shifts.filter(s => !(s.period === period && (s.wardId.startsWith('er-') || s.wardId === 'referral'))), ...newERShifts] }));
    } catch (e: any) { alert(`Team calculation failed: ${e.message}`); } finally { setSyncing(false); }
  }, [teams, erConfig, data.shifts]);

  const calculateTeamWardRoster = useCallback(async (period: string) => {
    setSyncing(true);
    try {
        if (teams.length === 0) { alert('Define teams in Staff Registry first.'); return; }
        const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const deactivatedDays = erConfig.deactivatedDays?.[period] || [];
        const daysInMonth = new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).getDate();

        // 1. Map Days to ER Teams (using same Round-Robin logic)
        const dayToERTeamId = new Map<number, string>();
        let activeDayIdx = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            if (deactivatedDays.includes(d)) continue;
            const tIdx = activeDayIdx % sortedTeams.length;
            dayToERTeamId.set(d, sortedTeams[tIdx].id);
            activeDayIdx++;
        }

        const newWardShifts: ShiftRecord[] = [];
        const teamWardShiftCounts: Record<string, number> = {};
        teams.forEach(t => teamWardShiftCounts[t.id] = 0);

        // 2. Assign Ward Shifts to Available Teams
        for (let day = 1; day <= daysInMonth; day++) {
            const erTeamId = dayToERTeamId.get(day);
            // Teams NOT on ER duty today
            const availableTeams = sortedTeams.filter(t => t.id !== erTeamId);
            if (availableTeams.length === 0) continue;

            data.wards.filter(w => !w.parentWardId).forEach((ward, wardIdx) => {
                // Round-robin available teams for this ward
                const tIdx = (day + wardIdx) % availableTeams.length;
                const targetTeam = availableTeams[tIdx];
                
                const { staffPerShift, shiftDuration } = ward.requirements;
                const shiftsPerDay = shiftDuration === '6h' ? 4 : shiftDuration === '12h' ? 2 : 1;
                
                for (let sIdx = 0; sIdx < shiftsPerDay; sIdx++) {
                    for (let p = 0; p < staffPerShift; p++) {
                        const members = targetTeam.memberIds;
                        if (members.length === 0) continue;
                        
                        // Round-robin members within the team for the day's slots
                        const dId = members[(sIdx * staffPerShift + p) % members.length];
                        newWardShifts.push({
                            id: `ward-team-${period}-${day}-${ward.id}-${sIdx}-${p}`,
                            period, day, wardId: ward.id, doctorId: dId, slotIndex: sIdx
                        });
                    }
                }
                teamWardShiftCounts[targetTeam.id]++;
            });
        }

        const delResp = await fetch('/api/shifts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period, type: 'ward' })
        });
        if (!delResp.ok) throw new Error('Failed to clear old ward shifts');

        const saveResp = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newWardShifts) });
        if (!saveResp.ok) throw new Error('Failed to save ward roster');

        setData(prev => ({ 
            ...prev, 
            shifts: [
                ...prev.shifts.filter(s => !(s.period === period && !s.wardId.startsWith('er-') && s.wardId !== 'referral')), 
                ...newWardShifts
            ] 
        }));
    } catch (e: any) { alert(`Team Ward calculation failed: ${e.message}`); } finally { setSyncing(false); }
  }, [teams, erConfig, data.shifts, data.wards]);

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
        const referralBufferDays = erConfig.referralBufferDays ?? 1;

        const canTakeShift = (doctorId: string, shift: ShiftRecord, shifts: ShiftRecord[]): boolean => {
            const doctorShifts = shifts.filter(s => s.period === period && s.doctorId === doctorId && s.id !== shift.id);
            const isNightER = (shift.slotIndex ?? 0) >= 2;
            const isWardShift = !shift.wardId.startsWith('er-') && shift.wardId !== 'referral';
            const shiftStart = SLOT_START[shift.slotIndex ?? 0] ?? 8;
            const shiftEnd   = SLOT_END[shift.slotIndex ?? 0] ?? 24;

            // Referral buffer: no shift at all within ±referralBufferDays of referral call
            if (shift.wardId === 'referral') {
                for (let offset = 1; offset <= referralBufferDays; offset++) {
                    if (doctorShifts.some(s => s.day === shift.day - offset || s.day === shift.day + offset)) return false;
                }
            }
            // Also block taking any shift if doctor already has a referral within buffer window
            const hasNearbyReferral = doctorShifts.some(s =>
                s.wardId === 'referral' &&
                Math.abs(s.day - shift.day) <= referralBufferDays
            );
            if (hasNearbyReferral) return false;

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
        // ER soft cap (10 calls) prevents loading a doctor with 12-13 ER calls
        // when redistributing. Referral moves are exempt from this cap.

        const ER_BALANCE_SOFT_MAX = 10;
        const countERCalls = (docId: string, shifts: ShiftRecord[]) =>
            shifts.filter(s => s.period === period && s.doctorId === docId && s.wardId.startsWith('er-')).length;

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
                        erCalls: countERCalls(d.id, currentShifts),
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
                    s.period === period && s.doctorId === rich.id && (s.wardId.startsWith('er-') || s.wardId === 'referral')
                );
                if (richER.length === 0) continue;

                for (let j = leaderboard.length - 1; j > i; j--) {
                    const poor = leaderboard[j];
                    const gap = rich.hours - poor.hours;
                    if (gap <= balanceThreshold) break; // inner loop can also stop early

                    const poorER = currentShifts.filter(s =>
                        s.period === period && s.doctorId === poor.id && (s.wardId.startsWith('er-') || s.wardId === 'referral')
                    );

                    // A. MOVE: give one of rich's ER shifts to poor
                    // Strategy: if rich is Male, try referral first (24h = max impact),
                    // acting as the primary male-to-male equalizer.
                    const richERSorted = [...richER].sort((a, b) => {
                        if (rich.gender === 'Male') {
                            // Referral (24h) first for males → biggest impact equalizer
                            const aRef = a.wardId === 'referral' ? 0 : 1;
                            const bRef = b.wardId === 'referral' ? 0 : 1;
                            if (aRef !== bRef) return aRef - bRef;
                        }
                        // Then by descending duration
                        return getDuration(b) - getDuration(a);
                    });

                    for (const s of richERSorted) {
                        if (s.wardId === 'referral' && poor.gender !== 'Male') continue;
                        if (!canTakeShift(poor.id, s, currentShifts)) continue;
                        // Don't push poor above soft ER cap (referral is exempt — it helps hours equity)
                        if (s.wardId !== 'referral' && poor.erCalls >= ER_BALANCE_SOFT_MAX) continue;

                        const dur = getDuration(s);
                        const newRich = rich.hours - dur;
                        const newPoor = poor.hours + dur;
                        if (newPoor > newRich) continue; // overshoot guard

                        const reduction = gap - (newRich - newPoor);
                        // Give a small bonus when referral is redistributed male→male
                        // so it is always preferred over an equal-reduction ER move
                        const referralBonus = (s.wardId === 'referral' && poor.gender === 'Male') ? 0.01 : 0;
                        if (reduction + referralBonus > bestReduction) {
                            bestReduction = reduction + referralBonus;
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
                            // Swapping non-referral ER shift onto poor who's already at soft cap
                            if (richShift.wardId !== 'referral' && poor.erCalls >= ER_BALANCE_SOFT_MAX) continue;

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


  const addLog = useCallback(async (action: AuditLog['action'], details: string, period: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      action,
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

  const updateTeams = useCallback(async (newTeams: Team[]) => {
    setSyncing(true);
    try {
      await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeams)
      });
      setTeams(newTeams);
    } catch (e) { alert('Failed to save teams.'); } finally { setSyncing(false); }
  }, []);

  const clearDatabase = useCallback(async () => {
    setSyncing(true);
    try {
      const resp = await fetch('/api/clear-database', { method: 'DELETE' });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Server error');
      }
      setData(prev => ({ ...prev, doctors: [], wards: [] }));
    } catch (e: any) {
      alert(`Clear failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }, []);

  return { ...data, wards: allWards, loading, syncing, erConfig, updateERConfig, addDoctor, deleteDoctor, updateDoctor, addWard, deleteWard, updateWard, generateMonthlyDispatch, calculateDailyRoster, calculateERCalls, clearRosterByPeriod, deleteDispatchByPeriod, updateAssignment, swapPoolDoctors, movePoolDoctor, swapShiftDoctors, swapERCalls, optimizeReferralsForMales, importData, doctorMap, wardMap, calculateTotalHours, manualAssignDoctor, autoBalanceWorkload, batchUpdateHistory, resolveFatigueConflict, clearDatabase, teams, updateTeams };
}
