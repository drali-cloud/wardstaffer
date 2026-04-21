import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Hospital, ClipboardList, FileUp, Plus, Trash2, Download, Calendar, ChevronRight, UserPlus, Edit2, RefreshCw, Archive, Save, ChevronLeft, User, LogOut, Shield, Clock, MapPin, Lock, Key, X, Check, Activity, ListChecks, ArrowLeft, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStaffingData } from './hooks/useStaffingData';
import { Doctor, Ward, Gender, Assignment, ShiftRecord } from './types';
import * as XLSX from 'xlsx';

type View = 'dashboard' | 'doctors' | 'wards' | 'archive' | 'assignments' | 'profile' | 'calendar';
type Role = 'resident' | 'admin';

interface AuthUser {
    id: string;
    name: string;
    role: Role;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
      const saved = localStorage.getItem('wardstaffer_user');
      return saved ? JSON.parse(saved) : null;
  });
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const staffing = useStaffingData();

  useEffect(() => {
      if (user) localStorage.setItem('wardstaffer_user', JSON.stringify(user));
      else localStorage.removeItem('wardstaffer_user');
  }, [user]);

  const handleLogin = React.useCallback((name: string, pass: string) => {
      const cleanName = name.trim().toLowerCase();
      if (cleanName === 'root' && pass === 'root') {
          setUser({ id: 'root', name: 'System Root', role: 'admin' });
          return true;
      }
      const doc = staffing.doctors.find(d => d.name.trim().toLowerCase() === cleanName);
      if (doc && (doc.password || '11111111') === pass.trim()) {
          setUser({ id: doc.id, name: doc.name, role: 'resident' });
          return true;
      }
      return false;
  }, [staffing.doctors]);

  const handleLogout = () => { setUser(null); setCurrentView('dashboard'); };

  if (!user) return <LoginPage onLogin={handleLogin} isLoading={staffing.loading} />;

  const handleExport = () => {
    const doctorsWs = XLSX.utils.json_to_sheet(staffing.doctors.map(d => ({ ID: d.id, Name: d.name, Gender: d.gender, PreviousWards: d.previousWards.join(', ') })));
    const periods = [...new Set(staffing.assignments.map(a => a.period))].sort();
    const gridRows: any[] = [];
    periods.forEach(p => {
        const periodAssignments = staffing.assignments.filter(a => a.period === p);
        let maxDocs = 0; const wardToDocs: Record<string, string[]> = {};
        staffing.wards.forEach(w => {
            const assignment = periodAssignments.find(a => a.wardId === w.id);
            const docNames = (assignment?.doctorIds || []).map(id => staffing.doctorMap.get(id)?.name || 'Unknown');
            wardToDocs[w.name] = docNames; maxDocs = Math.max(maxDocs, docNames.length);
        });
        for (let i = 0; i < maxDocs; i++) {
            const row: any = { 'Month': i === 0 ? p : '' };
            staffing.wards.forEach(w => { row[w.name] = wardToDocs[w.name][i] || ''; });
            gridRows.push(row);
        }
        gridRows.push({});
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gridRows), "Monthly Grid");
    XLSX.utils.book_append_sheet(wb, doctorsWs, "Registry");
    XLSX.writeFile(wb, `Hospital_Dispatch_${new Date().toISOString().slice(0, 7)}.xlsx`);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className="w-64 bg-slate-900 text-white flex flex-col h-full border-r border-slate-200 z-10 shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2"><div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">W</div><span className="text-xl font-semibold tracking-tight">WardStaffer</span></div>
          {user.role === 'admin' && <Shield className="w-4 h-4 text-amber-500" />}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} label="Overview" icon={<ClipboardList className="w-4 h-4" />} />
          <NavItem active={currentView === 'calendar'} onClick={() => setCurrentView('calendar')} label="Shift Calendar" icon={<Calendar className="w-4 h-4" />} />
          <NavItem active={currentView === 'profile'} onClick={() => setCurrentView('profile')} label="My Profile" icon={<User className="w-4 h-4" />} />
          <div className="h-px bg-slate-800 my-4"></div>
          <NavItem active={currentView === 'doctors'} onClick={() => setCurrentView('doctors')} label="Staff Registry" icon={<Users className="w-4 h-4" />} />
          <NavItem active={currentView === 'wards'} onClick={() => setCurrentView('wards')} label="Ward Config" icon={<Hospital className="w-4 h-4" />} />
          <NavItem active={currentView === 'archive'} onClick={() => { setCurrentView('archive'); setSelectedPeriod(null); }} label="Archives & Roster" icon={<Archive className="w-4 h-4" />} />
        </nav>
        <div className="p-6 border-t border-slate-800 bg-slate-950/50">
          <div className="space-y-4">
              <div className="flex items-center space-x-3 mb-2"><div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">{user.name.charAt(0)}</div><div className="overflow-hidden"><p className="text-xs font-bold text-white truncate">{user.name}</p><p className="text-[10px] text-slate-500 uppercase tracking-widest">{user.role}</p></div></div>
              <button onClick={handleLogout} className="w-full flex items-center space-x-3 text-xs text-red-400 hover:text-red-300 transition-colors pt-2 border-t border-slate-800"><LogOut className="w-3 h-3" /> <span>Sign Out</span></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm shrink-0 z-20">
          <div className="flex items-center space-x-3"><h1 className="text-lg font-semibold text-slate-800 capitalize">{currentView}</h1><div className="h-4 w-[1px] bg-slate-200"></div><div className="flex items-center text-[10px] text-slate-400 uppercase font-bold tracking-wider"><span>{user.role}</span><ChevronRight className="w-3 h-3" /> <span className="text-blue-600">{currentView}</span></div></div>
          {staffing.syncing && (<div className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /><span>Syncing...</span></div>)}
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50"><div className="max-w-7xl mx-auto"><AnimatePresence mode="wait"><motion.div key={currentView + selectedPeriod} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
          {currentView === 'dashboard' && <DashboardView staffing={staffing} user={user} />}
          {currentView === 'calendar' && <ShiftCalendarView staffing={staffing} />}
          {currentView === 'doctors' && <DoctorsView staffing={staffing} user={user} />}
          {currentView === 'wards' && <WardsView staffing={staffing} user={user} />}
          {currentView === 'archive' && <MonthlyArchiveView staffing={staffing} user={user} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} />}
          {currentView === 'assignments' && <AssignmentsView staffing={staffing} />}
          {currentView === 'profile' && <ProfileView staffing={staffing} user={user} />}
        </motion.div></AnimatePresence></div></div>
      </main>
    </div>
  );
}

function ShiftCalendarView({ staffing }: { staffing: any }) {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const period = viewDate.toISOString().slice(0, 7);
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayIdx = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const periodShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period);

    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const handleExportRoster = () => {
        if (periodShifts.length === 0) { alert('Generate roster first.'); return; }
        const wb = XLSX.utils.book_new();
        const days = [...new Set(periodShifts.map(s => s.day))].sort((a,b)=>a-b);
        const grid: any[] = [];
        days.forEach(day => {
            const dayShifts = periodShifts.filter(s => s.day === day);
            staffing.wards.forEach(w => {
                const wardShifts = dayShifts.filter(s => s.day === day && s.wardId === w.id);
                if (wardShifts.length > 0) {
                    grid.push({ 
                        Date: `${period}-${day}`, 
                        Ward: w.name, 
                        Staff: wardShifts.map(s => staffing.doctorMap.get(s.doctorId)?.name).join(', '),
                        'Shift Pattern': `${w.requirements.staffPerShift} Doc / ${w.requirements.shiftDuration}`
                    });
                }
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grid), "Daily Roster");
        XLSX.writeFile(wb, `Daily_Roster_${period}.xlsx`);
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4"><div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Calendar className="w-6 h-6" /></div><div><h2 className="text-xl font-bold text-slate-800">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}</h2><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Shift Operations Center</p></div></div>
                <div className="flex gap-2"><button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"><ArrowLeft className="w-4 h-4" /></button><button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"><ArrowRight className="w-4 h-4" /></button></div>
            </div>

            <div className="technical-card p-6 border-blue-100 ring-1 ring-blue-50 flex items-center justify-between gap-8">
                <div>
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-600" /> Roster Operations</h2>
                    <p className="text-xs text-slate-400">Calculate or export the daily shift schedule for this period.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => staffing.calculateDailyRoster(period)} className="btn-primary px-8 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Calculate Shifts</button>
                    <button onClick={handleExportRoster} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2"><Download className="w-4 h-4" /> Export Roster</button>
                </div>
            </div>
            
            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (<div key={d} className="bg-slate-50 p-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>))}
                {Array.from({ length: firstDayIdx }).map((_, i) => <div key={`empty-${i}`} className="bg-slate-50/50 min-h-[70px]" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayShiftsCount = periodShifts.filter((s: ShiftRecord) => s.day === day).length;
                    return (
                        <div key={day} onClick={() => setSelectedDay(day)} className={`bg-white p-2 min-h-[90px] cursor-pointer hover:bg-blue-50 transition-all border-b border-r border-slate-100 group relative ${selectedDay === day ? 'ring-2 ring-blue-500 z-10' : ''}`}>
                            <span className={`text-xs font-bold ${day === new Date().getDate() && viewDate.getMonth() === new Date().getMonth() ? 'w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center' : 'text-slate-700'}`}>{day}</span>
                            {dayShiftsCount > 0 && (<div className="mt-2 space-y-1"><div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /><span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{dayShiftsCount} Slots</span></div><div className="flex flex-wrap gap-0.5 mt-1">{periodShifts.filter((s: ShiftRecord) => s.day === day).slice(0, 5).map((s: ShiftRecord) => (<div key={s.id} className="w-0.5 h-2.5 bg-blue-100 rounded-full" />))}</div></div>)}
                        </div>
                    );
                })}
            </div>

            <AnimatePresence>
                {selectedDay && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                            <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                                <div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-lg">{selectedDay}</div><div><h3 className="text-lg font-bold">Daily Station Report</h3><p className="text-xs text-slate-400">{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay))}</p></div></div>
                                <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                                {staffing.wards.map((w: Ward) => {
                                    const dayShifts = periodShifts.filter((s: ShiftRecord) => s.day === selectedDay && s.wardId === w.id);
                                    return (
                                        <div key={w.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"><Hospital className="w-5 h-5" /></div>
                                                <div><p className="text-sm font-bold text-slate-800">{w.name}</p><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{w.requirements.shiftDuration} Pattern</p></div>
                                            </div>
                                            <div className="flex -space-x-2">
                                                {dayShifts.map((s: ShiftRecord) => (
                                                    <div key={s.id} className="group/avatar relative">
                                                        <div className="w-10 h-10 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 cursor-help ring-1 ring-slate-100">{staffing.doctorMap.get(s.doctorId)?.name.charAt(0)}</div>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] rounded opacity-0 group-hover/avatar:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 font-bold uppercase">{staffing.doctorMap.get(s.doctorId)?.name}</div>
                                                    </div>
                                                ))}
                                                {dayShifts.length === 0 && <span className="text-[10px] text-slate-300 font-bold uppercase italic">Unassigned</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end"><button onClick={() => setSelectedDay(null)} className="btn-primary px-8">Close Report</button></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function LoginPage({ onLogin, isLoading }: { onLogin: (u: string, p: string) => boolean, isLoading: boolean }) {
    const [name, setName] = useState(''); const [pass, setPass] = useState(''); const [error, setError] = useState(false);
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-8 space-y-8">
                <div className="text-center"><div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"><Hospital className="w-8 h-8 text-white" /></div><h1 className="text-2xl font-bold text-white">WardStaffer Portal</h1><p className="text-slate-500 text-sm mt-2">Monthly Clinical Dispatch</p></div>
                <form onSubmit={e => { e.preventDefault(); if (onLogin(name, pass)) setError(false); else setError(true); }} className="space-y-6">
                    <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medical Staff Name</label><div className="relative flex items-center group"><User className="absolute left-4 w-5 h-5 text-slate-500 pointer-events-none transition-colors group-focus-within:text-blue-600" /><input type="text" placeholder="Full Registered Name" className="w-full bg-white border border-slate-200 text-slate-950 rounded-xl py-4.5 px-12 text-sm text-center focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm font-medium" value={name} onChange={e => setName(e.target.value)} disabled={isLoading} /></div></div>
                    <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Security Access Key</label><div className="relative flex items-center group"><Lock className="absolute left-4 w-5 h-5 text-slate-500 pointer-events-none transition-colors group-focus-within:text-blue-600" /><input type="password" placeholder="••••••••" className="w-full bg-white border border-slate-200 text-slate-950 rounded-xl py-4.5 px-12 text-sm text-center focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm font-medium" value={pass} onChange={e => setPass(e.target.value)} disabled={isLoading} /></div></div>
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:bg-slate-700 flex items-center justify-center gap-2">{isLoading ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Syncing...</>) : ("Authenticate & Access")}</button>
                </form>
            </div>
        </div>
    );
}

function ProfileView({ staffing, user }: { staffing: any, user: AuthUser }) {
    const doctor = staffing.doctors.find((d: any) => d.name === user.name);
    const myAssignments = staffing.assignments.filter((a: any) => a.doctorIds.includes(user.id)).sort((a: any, b: any) => b.period.localeCompare(a.period));
    const [newPass, setNewPass] = useState('');
    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-6"><div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl font-bold text-blue-600 border border-blue-100">{user.name.charAt(0)}</div><div><h2 className="text-2xl font-bold text-slate-900">{user.name}</h2><div className="flex items-center gap-3 mt-2"><span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-full">ID: {user.id}</span><span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-full">{user.role}</span></div></div></div>
                {user.id !== 'root' && (<div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Access Key</label><div className="flex gap-2"><input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="text-xs p-2 rounded-lg border border-slate-200" /><button onClick={() => staffing.updateDoctor({ ...doctor, password: newPass })} className="bg-blue-600 text-white p-2 rounded-lg"><Key className="w-4 h-4" /></button></div></div>)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="technical-card p-6"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Current Assignment</h3>{myAssignments[0] ? (<div className="p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="text-[10px] uppercase text-blue-500 font-bold mb-1">Ward</p><p className="text-xl font-bold text-blue-900">{staffing.wardMap.get(myAssignments[0].wardId)?.name}</p><p className="text-xs text-blue-700 mt-4">Rotation Period: {myAssignments[0].period}</p></div>) : (<p className="text-xs text-slate-400 italic py-8 text-center">No assignment.</p>)}</div>
                <div className="technical-card p-6"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> History</h3><div className="flex flex-wrap gap-2">{doctor?.previousWards?.map((wId: string) => (<span key={wId} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-200">{staffing.wardMap.get(wId)?.name || wId}</span>)) || <p className="text-xs text-slate-400 italic">None.</p>}</div></div>
            </div>
        </div>
    );
}

const DashboardView = React.memo(({ staffing, user }: { staffing: any, user: AuthUser }) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [targetPeriod, setTargetPeriod] = useState(currentMonth);
  const myAssignment = staffing.assignments.filter((a: any) => a.doctorIds.includes(user.id)).sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"><div className="relative z-10"><h2 className="text-2xl font-bold">Hospital Overview</h2><p className="text-blue-100 mt-2 text-sm max-w-lg">{user.role === 'admin' ? "Full Control Mode." : myAssignment ? `Assigned to ${staffing.wardMap.get(myAssignment.wardId)?.name} for ${myAssignment.period}.` : "No active rotation."}</p></div><Hospital className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/10 rotate-12" /></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6"><StatCard label="Total Staff" value={staffing.doctors.length} icon={<Users className="w-5 h-5 text-blue-600" />} /><StatCard label="Monthly Wards" value={staffing.wards.length} icon={<Hospital className="w-5 h-5 text-blue-600" />} /><StatCard label="Total Rotations" value={staffing.assignments.length} icon={<Archive className="w-5 h-5 text-blue-600" />} /><StatCard label="Archives" value={new Set(staffing.assignments.map(a => a.period)).size} icon={<Calendar className="w-5 h-5 text-blue-600" />} /></div>
      {user.role === 'admin' && (
        <div className="technical-card p-8 border-blue-100 ring-1 ring-blue-50 flex items-center justify-between gap-8">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2"><Save className="w-4 h-4 text-blue-600" /> Monthly Dispatch Generator</h2>
            <p className="text-xs text-slate-400">Initialize the personnel pool for each ward for the next rotation cycle.</p>
          </div>
          <div className="flex gap-4">
            <input type="month" className="text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl" value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value)} />
            <button disabled={staffing.syncing} onClick={() => { if(confirm(`Generate monthly pool for ${targetPeriod}?`)) staffing.generateMonthlyDispatch(targetPeriod); }} className="btn-primary px-8">Generate Personnel Pool</button>
            <button onClick={() => {
                const periodAssignments = staffing.assignments.filter((a: Assignment) => a.period === targetPeriod);
                if (periodAssignments.length === 0) { alert('No dispatch found for this period.'); return; }
                const gridRows: any[] = [];
                let maxDocs = 0; const wardToDocs: Record<string, string[]> = {};
                staffing.wards.forEach(w => {
                    const assignment = periodAssignments.find(a => a.wardId === w.id);
                    const docNames = (assignment?.doctorIds || []).map(id => staffing.doctorMap.get(id)?.name || 'Unknown');
                    wardToDocs[w.name] = docNames; maxDocs = Math.max(maxDocs, docNames.length);
                });
                for (let i = 0; i < maxDocs; i++) {
                    const row: any = { 'Month': i === 0 ? targetPeriod : '' };
                    staffing.wards.forEach(w => { row[w.name] = wardToDocs[w.name][i] || ''; });
                    gridRows.push(row);
                }
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gridRows), "Monthly Dispatch");
                XLSX.writeFile(wb, `Dispatch_${targetPeriod}.xlsx`);
            }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2"><Download className="w-4 h-4" /> Export Pool</button>
          </div>
        </div>
      )}
    </div>
  );
});

const DoctorsView = React.memo(({ staffing, user }: { staffing: any, user: AuthUser }) => {
  const [showAdd, setShowAdd] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({ name: '', gender: 'Male', previousWards: [] });
  const filtered = useMemo(() => staffing.doctors.filter((d: any) => d.id !== 'root'), [staffing.doctors]);
  const handleAdd = () => { 
    if (!newDoctor.name) return; 
    const payload = { 
      id: editingId || Math.random().toString(36).substr(2, 9), 
      name: newDoctor.name.trim(), 
      gender: newDoctor.gender as Gender, 
      password: newDoctor.password,
      previousWards: newDoctor.previousWards || [] 
    }; 
    if (editingId) staffing.updateDoctor(payload); 
    else staffing.addDoctor(payload); 
    setShowAdd(false); 
    setEditingId(null); 
    setNewDoctor({ name: '', gender: 'Male', previousWards: [] }); 
  };
  return (<div className="space-y-6"><div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div><h2 className="text-xl font-bold text-slate-800">Personnel Registry</h2></div>{user.role === 'admin' && (<button className="btn-primary" onClick={() => setShowAdd(!showAdd)}><UserPlus className="w-4 h-4" /> Register</button>)}</div><AnimatePresence>{showAdd && user.role === 'admin' && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="technical-card p-8 bg-white mb-6 border-blue-100 ring-1 ring-blue-50"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label className="text-[10px] uppercase font-bold text-slate-400">Name</label><input type="text" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newDoctor.name} onChange={e => setNewDoctor(prev => ({ ...prev, name: e.target.value }))} /></div><div><label className="text-[10px] uppercase font-bold text-slate-400">Gender</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newDoctor.gender} onChange={e => setNewDoctor(prev => ({ ...prev, gender: e.target.value as Gender }))}><option value="Male">Male</option><option value="Female">Female</option></select></div></div><div className="flex gap-3 mt-8 pt-6 border-t border-slate-100"><button className="btn-primary px-8" onClick={handleAdd}>Save</button></div></div></motion.div>)}</AnimatePresence><div className="technical-card overflow-hidden"><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">ID</th><th className="col-header">Name</th><th className="col-header">Gender</th>{user.role === 'admin' && <th className="col-header text-right">Actions</th>}</tr></thead><tbody className="text-sm divide-y divide-slate-100">{filtered.map((d: Doctor) => (<tr key={d.id} className="hover:bg-slate-50/50 group"><td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">{d.id}</td><td className="px-6 py-4 font-semibold text-slate-800">{d.name}</td><td className="px-6 py-4 text-xs"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${d.gender === 'Male' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-pink-50 text-pink-600 border-pink-100'}`}>{d.gender}</span></td>{user.role === 'admin' && <td className="px-6 py-4 text-right flex justify-end gap-2"><button className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100" onClick={() => { setEditingId(d.id); setNewDoctor(d); setShowAdd(true); }}><Edit2 className="w-4 h-4" /></button><button className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={() => { if(confirm('Delete?')) staffing.deleteDoctor(d.id); }}><Trash2 className="w-4 h-4" /></button></td>}</tr>))}</tbody></table></div></div>);
});

const WardsView = React.memo(({ staffing, user }: { staffing: any, user: AuthUser }) => {
    const [showAdd, setShowAdd] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [newWard, setNewWard] = useState<Partial<Ward>>({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None', staffPerShift: 1, shiftDuration: '12h' } });
    const handleAdd = () => { 
        if (!newWard.name) return; 
        const payload = { 
            id: editingId || `ward-${Math.random().toString(36).substr(2, 5)}`, 
            name: newWard.name.trim(), 
            parentWardId: newWard.parentWardId,
            requirements: { 
                totalDoctors: Number(newWard.requirements?.totalDoctors || 2), 
                genderDiversity: newWard.requirements?.genderDiversity || 'None', 
                requiredMale: Number(newWard.requirements?.requiredMale || 0),
                requiredFemale: Number(newWard.requirements?.requiredFemale || 0),
                staffPerShift: Number(newWard.requirements?.staffPerShift || 1) as 1|2, 
                shiftDuration: newWard.requirements?.shiftDuration || '12h' 
            } 
        }; 
        if (editingId) staffing.updateWard(payload); else staffing.addWard(payload); 
        setShowAdd(false); setEditingId(null); setNewWard({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None', staffPerShift: 1, shiftDuration: '12h' } }); 
    };
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div><h2 className="text-xl font-bold text-slate-800">Unit Configuration</h2></div>{user.role === 'admin' && (<button className="btn-primary" onClick={() => setShowAdd(!showAdd)}><Plus className="w-4 h-4" /> Add Unit</button>)}</div>
            <AnimatePresence>{showAdd && user.role === 'admin' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="technical-card p-8 space-y-6 bg-white mb-6 border-blue-100 ring-1 ring-blue-50">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="md:col-span-2"><label className="text-[10px] uppercase font-bold text-slate-400">Designation</label><input type="text" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.name} onChange={e => setNewWard(prev => ({ ...prev, name: e.target.value }))} /></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Monthly Capacity</label><input type="number" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.totalDoctors} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, totalDoctors: parseInt(e.target.value) } }))} /></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Gender Policy</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.genderDiversity} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, genderDiversity: e.target.value as any } }))}><option value="None">No Preference</option><option value="Balanced">Balanced Mix</option><option value="Specific">Specific Quota</option></select></div>
                        </div>
                        {newWard.requirements?.genderDiversity === 'Specific' && (
                            <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Required Male</label><input type="number" className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg" value={newWard.requirements?.requiredMale} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, requiredMale: parseInt(e.target.value) } }))} /></div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Required Female</label><input type="number" className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg" value={newWard.requirements?.requiredFemale} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, requiredFemale: parseInt(e.target.value) } }))} /></div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Hierarchy</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.parentWardId || ''} onChange={e => setNewWard(prev => ({ ...prev, parentWardId: e.target.value || undefined }))}><option value="">Main Unit (Stand-alone)</option>{staffing.wards.filter((w: Ward) => w.id !== editingId).map((w: Ward) => (<option key={w.id} value={w.id}>Subordinate to {w.name}</option>)}</select></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Shift Coverage</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.staffPerShift} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, staffPerShift: parseInt(e.target.value) as 1|2 } }))}><option value={1}>1 Physician Per Shift</option><option value={2}>2 Physicians Per Shift</option></select></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Shift Duration</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.shiftDuration} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, shiftDuration: e.target.value as any } }))}><option value="6h">6 Hours</option><option value="12h">12 Hours</option><option value="24h">24 Hours</option></select></div>
                        </div>
                        <div className="flex gap-3 pt-6 border-t border-slate-100"><button className="btn-primary px-8" onClick={handleAdd}>Save Unit</button></div>
                    </div>
                </motion.div>
            )}</AnimatePresence>
            <div className="technical-card overflow-hidden">
                <table className="technical-grid">
                    <thead><tr className="bg-slate-50/50"><th className="col-header">ID</th><th className="col-header">Name</th><th className="col-header">Shift Specs</th><th className="col-header">Status</th><th className="col-header">Capacity</th>{user.role === 'admin' && <th className="col-header text-right">Actions</th>}</tr></thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                        {staffing.wards.map((w: Ward) => (
                            <tr key={w.id} className="hover:bg-slate-50/50 group"><td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">{w.id}</td><td className="px-6 py-4 font-semibold text-slate-800">{w.name}</td>
                            <td className="px-6 py-4"><div className="flex gap-2"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase rounded border border-blue-100 flex items-center gap-1"><Activity className="w-3 h-3" /> {w.requirements.staffPerShift} Doc</span><span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded border border-slate-200 flex items-center gap-1"><Clock className="w-3 h-3" /> {w.requirements.shiftDuration}</span></div></td>
                            <td className="px-6 py-4">
                                {w.parentWardId ? (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-bold uppercase rounded border border-slate-200 flex items-center gap-1"><Link className="w-3 h-3" /> Sub to {staffing.wardMap.get(w.parentWardId)?.name}</span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] font-bold uppercase rounded border border-green-100">Main Station</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">{w.requirements.totalDoctors} Total Staff</td>
                            {user.role === 'admin' && <td className="px-6 py-4 text-right flex justify-end gap-2"><button className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100" onClick={() => { setEditingId(w.id); setNewWard(w); setShowAdd(true); }}><Edit2 className="w-4 h-4" /></button><button className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={() => { if(confirm('Remove?')) staffing.deleteWard(w.id); }}><Trash2 className="w-4 h-4" /></button></td>}</tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});
});

const MonthlyArchiveView = ({ staffing, user, selectedPeriod, onSelect }: { staffing: any, user: AuthUser, selectedPeriod: string | null, onSelect: (m: string | null) => void }) => {
    const [viewMode, setViewMode] = useState<'dispatch' | 'roster'>('dispatch');
    const periods = useMemo(() => [...new Set(staffing.assignments.map((a: Assignment) => a.period))].sort((a, b) => b.localeCompare(a)), [staffing.assignments]);
    if (selectedPeriod) {
        const periodAssignments = staffing.assignments.filter((a: Assignment) => a.period === selectedPeriod);
        const periodShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === selectedPeriod);
        const handleExportDispatch = () => {
            const gridRows: any[] = [];
            let maxDocs = 0; const wardToDocs: Record<string, string[]> = {};
            staffing.wards.forEach(w => {
                const assignment = periodAssignments.find(a => a.wardId === w.id);
                const docNames = (assignment?.doctorIds || []).map(id => staffing.doctorMap.get(id)?.name || 'Unknown');
                wardToDocs[w.name] = docNames; maxDocs = Math.max(maxDocs, docNames.length);
            });
            for (let i = 0; i < maxDocs; i++) {
                const row: any = { 'Month': i === 0 ? selectedPeriod : '' };
                staffing.wards.forEach(w => { row[w.name] = wardToDocs[w.name][i] || ''; });
                gridRows.push(row);
            }
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gridRows), "Monthly Dispatch");
            XLSX.writeFile(wb, `Dispatch_${selectedPeriod}.xlsx`);
        };
        const handleExportRoster = () => {
            if (periodShifts.length === 0) { alert('Generate roster first.'); return; }
            const wb = XLSX.utils.book_new();
            const days = [...new Set(periodShifts.map(s => s.day))].sort((a,b)=>a-b);
            const grid: any[] = [];
            days.forEach(day => {
                const dayShifts = periodShifts.filter(s => s.day === day);
                staffing.wards.forEach(w => {
                    const wardShifts = dayShifts.filter(s => s.day === day && s.wardId === w.id);
                    if (wardShifts.length > 0) {
                        grid.push({ 
                            Date: `${selectedPeriod}-${day}`, 
                            Ward: w.name, 
                            Staff: wardShifts.map(s => staffing.doctorMap.get(s.doctorId)?.name).join(', '),
                            'Shift Pattern': `${w.requirements.staffPerShift} Doc / ${w.requirements.shiftDuration}`
                        });
                    }
                });
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grid), "Daily Roster");
            XLSX.writeFile(wb, `Daily_Roster_${selectedPeriod}.xlsx`);
        };
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center"><div className="flex items-center gap-4"><button onClick={() => onSelect(null)} className="flex items-center text-xs font-bold text-blue-600 uppercase tracking-widest"><ChevronLeft className="w-4 h-4" /> Archive</button><div className="h-4 w-[1px] bg-slate-200"></div><div className="flex bg-slate-100 p-1 rounded-lg"><button onClick={() => setViewMode('dispatch')} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${viewMode === 'dispatch' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Dispatch Pool</button><button onClick={() => setViewMode('roster')} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${viewMode === 'roster' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Daily Roster</button></div></div><div className="flex gap-2">{user.role === 'admin' && viewMode === 'roster' && (<button onClick={() => staffing.calculateDailyRoster(selectedPeriod)} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"><RefreshCw className="w-3.5 h-3.5" /> Calculate Shifts</button>)}<button onClick={handleExportDispatch} className="flex items-center gap-2 text-[10px] font-bold uppercase border border-blue-200 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"><Download className="w-3.5 h-3.5" /> Export Dispatch</button><button onClick={handleExportRoster} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"><ListChecks className="w-3.5 h-3.5" /> Export Roster</button></div></div>
                <div className="technical-card overflow-hidden">{viewMode === 'dispatch' ? (<table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Ward Unit</th><th className="col-header">Monthly Personnel Pool</th></tr></thead><tbody className="text-sm divide-y divide-slate-100">{periodAssignments.map((a: Assignment) => (<tr key={a.id}><td className="px-6 py-4 font-semibold text-slate-800">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1">{a.doctorIds.map(id => (<span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{staffing.doctorMap.get(id)?.name}</span>))}</div></td></tr>))}</tbody></table>) : (<div className="p-0">{periodShifts.length === 0 ? (<div className="p-20 text-center space-y-4"><Calendar className="w-12 h-12 text-slate-200 mx-auto" /><p className="text-slate-400 text-sm">No roster generated yet. Click <b>Calculate Shifts</b>.</p></div>) : (<div className="max-h-[600px] overflow-auto"><table className="technical-grid border-separate border-spacing-0"><thead><tr className="bg-slate-50 sticky top-0 z-10 shadow-sm"><th className="col-header bg-slate-50">Day</th>{staffing.wards.map(w => (<th key={w.id} className="col-header bg-slate-50 border-l border-slate-100">{w.name}</th>))}</tr></thead><tbody className="text-xs divide-y divide-slate-100">{[...new Set(periodShifts.map(s => s.day))].sort((a,b)=>a-b).map(day => (<tr key={day} className="hover:bg-slate-50/50"><td className="px-4 py-3 font-bold text-blue-600 border-r border-slate-100 sticky left-0 bg-white z-20">Day {day}</td>{staffing.wards.map(w => { const shifts = periodShifts.filter(s => s.day === day && s.wardId === w.id); return (<td key={w.id} className="px-4 py-3 border-l border-slate-50"><div className="space-y-2">{shifts.map(s => (<div key={s.id} className="flex flex-col border-b border-slate-50 pb-1 last:border-0"><span className="text-[10px] font-bold text-slate-800">{staffing.doctorMap.get(s.doctorId)?.name}</span><span className="text-[8px] text-slate-400 uppercase font-bold">Slot {s.slotIndex + 1} ({w.requirements.shiftDuration})</span></div>))}</div></td>); })}</tr>))}</tbody></table></div>)}</div>)}</div>
            </div>
        );
    }
    return (<div className="space-y-6"><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center"><div><h2 className="text-xl font-bold text-slate-800">Rotation Archives</h2><p className="text-xs text-slate-500 mt-1">Manage monthly dispatches and daily shift rosters.</p></div></div><div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">{periods.map(p => (<div key={p} className="technical-card p-6 cursor-pointer hover:border-blue-300 transition-all group relative"><div onClick={() => onSelect(p)}><div className="bg-blue-50 p-2 rounded-lg text-blue-600 w-fit mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Archive className="w-5 h-5" /></div><h3 className="text-lg font-bold text-slate-800">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(p + '-01'))}</h3><div className="mt-4 pt-4 border-t border-slate-100 flex items-center text-[10px] font-bold text-blue-600 uppercase tracking-widest"><span>Access Roster</span><ChevronRight className="w-3 h-3" /></div></div>{user.role === 'admin' && (<button onClick={(e) => { e.stopPropagation(); if(confirm(`Purge all records for ${p}?`)) staffing.deleteDispatchByPeriod(p); }} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>)}</div>))}</div></div>);
};

const AssignmentsView = React.memo(({ staffing }: { staffing: any }) => {
    return (<div className="space-y-6"><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h2 className="text-xl font-bold text-slate-800">Dispatch History</h2></div><div className="technical-card overflow-hidden"><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Period</th><th className="col-header">Ward</th><th className="col-header">Personnel Pool</th></tr></thead><tbody className="text-sm divide-y divide-slate-100">{staffing.assignments.slice().reverse().map((a: Assignment) => (<tr key={a.id}><td className="px-6 py-4 text-[10px] font-mono text-blue-600 font-bold uppercase">{a.period}</td><td className="px-6 py-4 font-semibold text-slate-800">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1.5 font-mono text-[9px]">{a.doctorIds.map(id => (<span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">{staffing.doctorMap.get(id)?.name}</span>))}</div></td></tr>))}</tbody></table></div></div>);
});

function NavItem({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) { return (<div onClick={onClick} className={`sidebar-nav-item flex items-center space-x-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><div className={`${active ? 'text-white' : 'text-slate-500'}`}>{icon}</div><span className="text-sm font-medium">{label}</span></div>); }
function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) { return (<div className="bg-white border border-slate-200 rounded-xl p-6 flex items-start justify-between shadow-sm hover:shadow-md transition-shadow"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p><p className="text-3xl font-bold text-slate-900">{value}</p></div><div className="bg-blue-50 p-2.5 rounded-lg">{icon}</div></div>); }
