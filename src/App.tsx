import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Hospital, ClipboardList, FileUp, Plus, Trash2, Download, Calendar, ChevronRight, UserPlus, Edit2, RefreshCw, Archive, Save, ChevronLeft, User, LogOut, Shield, Clock, MapPin, Lock, Key, X, Check, Activity, ListChecks, ArrowLeft, ArrowRight, Link
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

  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col h-full border-r border-slate-200 z-50 transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} shrink-0`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2"><div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">W</div><span className="text-xl font-semibold tracking-tight">WardStaffer</span></div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-800 rounded text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setSidebarOpen(false); }} label="Overview" icon={<ClipboardList className="w-4 h-4" />} />
          <NavItem active={currentView === 'profile'} onClick={() => { setCurrentView('profile'); setSidebarOpen(false); }} label="My Profile" icon={<User className="w-4 h-4" />} />
          <div className="h-px bg-slate-800 my-4"></div>
          <NavItem active={currentView === 'doctors'} onClick={() => { setCurrentView('doctors'); setSidebarOpen(false); }} label="Staff Registry" icon={<Users className="w-4 h-4" />} />
          <NavItem active={currentView === 'wards'} onClick={() => { setCurrentView('wards'); setSidebarOpen(false); }} label="Ward Config" icon={<Hospital className="w-4 h-4" />} />
          <NavItem active={currentView === 'calendar'} onClick={() => { setCurrentView('calendar'); setSidebarOpen(false); }} label="Shift Calendar" icon={<Calendar className="w-4 h-4" />} />
          <NavItem active={currentView === 'er_calls'} onClick={() => { setCurrentView('er_calls'); setSidebarOpen(false); }} label="ER On-Call" icon={<Activity className="w-4 h-4 text-amber-500" />} />
          <NavItem active={currentView === 'archive'} onClick={() => { setCurrentView('archive'); setSelectedPeriod(null); setSidebarOpen(false); }} label="Archives & Roster" icon={<Archive className="w-4 h-4" />} />
        </nav>
        <div className="p-6 border-t border-slate-800 bg-slate-950/50">
          <div className="space-y-4">
              <div className="flex items-center space-x-3 mb-2"><div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">{user.name.charAt(0)}</div><div className="overflow-hidden"><p className="text-xs font-bold text-white truncate">{user.name}</p><p className="text-[10px] text-slate-500 uppercase tracking-widest">{user.role}</p></div></div>
              <button onClick={handleLogout} className="w-full flex items-center space-x-3 text-xs text-red-400 hover:text-red-300 transition-colors pt-2 border-t border-slate-800"><LogOut className="w-3 h-3" /> <span>Sign Out</span></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between shadow-sm shrink-0 z-20">
          <div className="flex items-center space-x-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-50 rounded-lg border border-slate-200 mr-1"><ListChecks className="w-5 h-5 text-slate-600" /></button>
            <h1 className="text-sm lg:text-lg font-semibold text-slate-800 capitalize truncate">{currentView === 'er_calls' ? 'ER On-Call' : currentView}</h1>
            <div className="hidden sm:block h-4 w-[1px] bg-slate-200"></div>
            <div className="hidden sm:flex items-center text-[10px] text-slate-400 uppercase font-bold tracking-wider"><span>{user.role}</span><ChevronRight className="w-3 h-3" /> <span className="text-blue-600">{currentView === 'er_calls' ? 'ER On-Call' : currentView}</span></div>
          </div>
          {staffing.syncing && (<div className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /><span>Syncing...</span></div>)}
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={currentView + (selectedPeriod || '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                {currentView === 'dashboard' && <DashboardView staffing={staffing} user={user} />}
                {currentView === 'calendar' && <ShiftCalendarView staffing={staffing} />}
                {currentView === 'er_calls' && <ERCallsView staffing={staffing} user={user!} />}
                {currentView === 'doctors' && <DoctorsView staffing={staffing} user={user} />}
                {currentView === 'wards' && <WardsView staffing={staffing} user={user} />}
                {currentView === 'archive' && <MonthlyArchiveView staffing={staffing} user={user} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} />}
                {currentView === 'assignments' && <AssignmentsView staffing={staffing} />}
                {currentView === 'profile' && <ProfileView staffing={staffing} user={user} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function ShiftCalendarView({ staffing }: { staffing: any }) {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const period = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
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
                    <button onClick={() => { if(confirm('Clear all shifts for this month? Personnel assignments will be kept.')) staffing.clearRosterByPeriod(period); }} className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2"><Trash2 className="w-4 h-4" /> Clear Roster</button>
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

function ERCallsView({ staffing, user }: { staffing: any, user: User }) {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [dragSourceWard, setDragSourceWard] = useState<string | null>(null);
    const isAdmin = user.role === 'admin';

    const period = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayIdx = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    
    const erShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period && s.wardId.startsWith('er-'));

    const handleDrop = (cat: 'men' | 'women' | 'pediatric') => {
        if (!dragSourceWard || !isAdmin) return;
        const newConfig = { ...staffing.erConfig };
        if (newConfig[cat].includes(dragSourceWard)) return;
        newConfig[cat] = [...newConfig[cat], dragSourceWard];
        staffing.updateERConfig(newConfig);
        setDragSourceWard(null);
    };

    const handleClear = (cat: 'men' | 'women' | 'pediatric') => {
        if (!isAdmin) return;
        const newConfig = { ...staffing.erConfig, [cat]: [] };
        staffing.updateERConfig(newConfig);
    };

    return (
        <div className="space-y-6 pb-24 px-1">
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="bg-amber-50 p-2 md:p-3 rounded-xl text-amber-600"><Activity className="w-5 h-5 md:w-6 md:h-6" /></div>
                    <div><h2 className="text-lg md:text-xl font-bold text-slate-800 leading-none">ER Call Center</h2><p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Operational Duty Control</p></div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-2">
                    <div className="flex gap-1"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"><ArrowLeft className="w-4 h-4" /></button><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"><ArrowRight className="w-4 h-4" /></button></div>
                    {isAdmin && (
                        <button onClick={() => staffing.calculateERCalls(period, staffing.erConfig)} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-[10px] font-bold uppercase bg-amber-600 text-white px-4 py-2.5 rounded-xl hover:bg-amber-700 shadow-lg shadow-amber-600/20 transition-all"><RefreshCw className="w-3.5 h-3.5" /> Calculate</button>
                    )}
                </div>
            </div>

            {isAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2"><Hospital className="w-3.5 h-3.5 text-blue-600" /> Source Wards</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                            {staffing.wards.map((w: Ward) => (
                                <div key={w.id} draggable={isAdmin} onDragStart={() => setDragSourceWard(w.id)} className={`px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold text-slate-600 ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-blue-400' : ''} transition-all`}>{w.name}</div>
                            ))}
                        </div>
                    </div>
                    {(['men', 'women', 'pediatric'] as const).map(cat => (
                        <div key={cat} onDragOver={e => isAdmin && e.preventDefault()} onDrop={() => handleDrop(cat)} className={`bg-white p-4 rounded-2xl border-2 border-dashed border-slate-100 ${isAdmin ? 'hover:border-amber-400 hover:bg-amber-50/20' : ''} transition-all min-h-[100px]`}>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2"><Users className="w-3.5 h-3.5 text-amber-500" /> {cat}</h3>
                                {isAdmin && <button onClick={() => handleClear(cat)} className="text-[8px] font-bold text-slate-300 hover:text-red-500 uppercase">Clear</button>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {staffing.erConfig[cat]?.map((wId: string) => (
                                    <div key={wId} className="px-2 py-0.5 bg-amber-50 border border-amber-100 rounded text-[8px] font-bold text-amber-600 uppercase">{staffing.wardMap.get(wId)?.name}</div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (<div key={d} className="bg-slate-50 p-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>))}
                {Array.from({ length: firstDayIdx }).map((_, i) => <div key={`e-${i}`} className="bg-slate-50/50 min-h-[90px]" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayShifts = erShifts.filter((s: ShiftRecord) => s.day === day);
                    return (
                        <div key={day} onClick={() => setSelectedDay(day)} className="bg-white p-2 min-h-[90px] cursor-pointer hover:bg-amber-50 transition-all border-b border-r border-slate-100 group relative">
                            <span className="text-xs font-bold text-slate-400">{day}</span>
                            {dayShifts.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /><span className="text-[8px] font-bold text-slate-500 uppercase">{dayShifts.length} Active Slots</span></div>
                                    <div className="flex gap-0.5">{dayShifts.map(s => <div key={s.id} className={`w-1 h-2 rounded-full ${s.wardId === 'er-pediatric' ? 'bg-green-400' : s.wardId === 'er-women' ? 'bg-pink-400' : 'bg-blue-400'}`} />)}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <AnimatePresence>
                {selectedDay && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-950/70 backdrop-blur-md">
                        <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[24px] md:rounded-[32px] shadow-2xl overflow-hidden border border-white/20 flex flex-col relative">
                            <div className="bg-slate-900 p-4 md:p-6 flex justify-between items-center text-white flex-shrink-0 border-b border-slate-800">
                                <div className="flex items-center gap-4"><div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-base md:text-lg">{selectedDay}</div><div><h3 className="text-base md:text-lg font-bold">Operational Report</h3><p className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest">{period}</p></div></div>
                                <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 overflow-y-auto flex-grow bg-slate-50/50">
                                <ERModalColumn title="Men" wardId="er-men" day={selectedDay} period={period} staffing={staffing} color="blue" slots={['08:00 - 14:00', '14:00 - 20:00', '20:00 - 02:00', '02:00 - 08:00']} />
                                <ERModalColumn title="Women" wardId="er-women" day={selectedDay} period={period} staffing={staffing} color="pink" slots={['08:00 - 14:00', '14:00 - 20:00', '20:00 - 02:00', '02:00 - 08:00']} />
                                <ERModalColumn title="Pediatric" wardId="er-pediatric" day={selectedDay} period={period} staffing={staffing} color="green" slots={['08:00 - 16:00', '16:00 - 00:00', '00:00 - 08:00']} />
                                <ERModalColumn title="Daily Referral" wardId="er-referral" day={selectedDay} period={period} staffing={staffing} color="indigo" slots={['24-Hour Duty Rotation']} />
                            </div>
                            <div className="p-5 md:p-6 bg-white border-t border-slate-100 flex-shrink-0"><button onClick={() => setSelectedDay(null)} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-sm uppercase tracking-widest">Finish Review</button></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ERModalColumn({ title, wardId, day, period, staffing, color, slots }: { title: string, wardId: string, day: number, period: string, staffing: any, color: 'blue' | 'pink' | 'green', slots: string[] }) {
    const dayShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period && s.day === day && s.wardId === wardId);
    const colors: any = { blue: 'text-blue-600 bg-blue-50 border-blue-100', pink: 'text-pink-600 bg-pink-50 border-pink-100', green: 'text-green-600 bg-green-50 border-green-100' };
    return (
        <div className="space-y-4">
            <h4 className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit ${colors[color]}`}>{title} Department</h4>
            <div className="space-y-3">
                {slots.map((time, idx) => {
                    const slotShifts = dayShifts.filter(s => s.slotIndex === idx);
                    const isHighDensity = (idx === 1 || idx === 2) && wardId !== 'er-pediatric';
                    return (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm group hover:border-blue-200 transition-all">
                            <p className="text-[8px] font-bold text-slate-400 uppercase mb-2">{time}</p>
                            <div className="space-y-2">
                                {Array.from({ length: isHighDensity ? 4 : (wardId === 'er-pediatric' ? 1 : 2) }).map((_, sIdx) => {
                                    const shift = slotShifts[sIdx];
                                    let badgeColor = 'bg-slate-50 text-slate-400';
                                    let roleLabel = '';
                                    
                                    if (isHighDensity) {
                                        if (sIdx < 2) {
                                            badgeColor = 'bg-yellow-50 text-yellow-700 border-yellow-100';
                                            roleLabel = 'Accidents & Surgery';
                                        } else {
                                            badgeColor = 'bg-green-50 text-green-700 border-green-100';
                                            roleLabel = 'Medical Emergencies';
                                        }
                                    } else {
                                        badgeColor = shift ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-400';
                                        roleLabel = 'General ER';
                                    }
                                    
                                    return (
                                        <div key={sIdx} className={`flex flex-col p-1.5 rounded-lg border ${badgeColor}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[7px] uppercase font-black tracking-tighter opacity-70">{roleLabel}</span>
                                                {shift && <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 transition-opacity"><Edit2 className="w-3 h-3" /></button>}
                                            </div>
                                            <span className="text-[9px] font-bold truncate">{shift ? staffing.doctorMap.get(shift.doctorId)?.name : 'Unassigned'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
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
    const [viewDate, setViewDate] = useState(new Date());
    const period = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const myShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period && s.doctorId === user.id);
    
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayIdx = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

    const [newPass, setNewPass] = useState('');
    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-6"><div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl font-bold text-blue-600 border border-blue-100">{user.name.charAt(0)}</div><div><h2 className="text-2xl font-bold text-slate-900">{user.name}</h2><div className="flex items-center gap-3 mt-2"><span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-full">ID: {user.id}</span><span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-full">{user.role}</span></div></div></div>
                {user.id !== 'root' && (<div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Access Key</label><div className="flex gap-2"><input type="password" placeholder="New Key" value={newPass} onChange={e => setNewPass(e.target.value)} className="text-xs p-2 rounded-lg border border-slate-200" /><button onClick={() => { staffing.updateDoctor({ ...doctor, password: newPass }); setNewPass(''); alert('Security Key Updated.'); }} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Key className="w-4 h-4" /></button></div></div>)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3"><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Calendar className="w-5 h-5" /></div><div><h3 className="text-sm font-bold text-slate-800">My Duty Calendar</h3><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}</p></div></div>
                            <div className="flex gap-1"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-50 rounded border border-slate-200"><ArrowLeft className="w-3.5 h-3.5" /></button><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-50 rounded border border-slate-200"><ArrowRight className="w-3.5 h-3.5" /></button></div>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
                            {['S','M','T','W','T','F','S'].map(d => (<div key={d} className="bg-slate-50/50 p-2 text-center text-[9px] font-bold text-slate-400">{d}</div>))}
                            {Array.from({ length: firstDayIdx }).map((_, i) => <div key={`e-${i}`} className="bg-white" />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const d = i + 1;
                                const shifts = myShifts.filter((s: ShiftRecord) => s.day === d);
                                return (
                                    <div key={d} className={`min-h-[70px] p-1 border-t border-l border-slate-50 relative ${shifts.length > 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                                        <span className={`text-[9px] font-bold ${shifts.length > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{d}</span>
                                        <div className="mt-1 space-y-1">
                                            {shifts.map(shift => {
                                                const isER = shift.wardId.startsWith('er-');
                                                return (
                                                    <div key={shift.id} className={`p-1 rounded text-[7px] font-bold uppercase leading-tight ${isER ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-600 text-white'}`}>
                                                        <p className="truncate">{isER ? 'ER Call' : staffing.wardMap.get(shift.wardId)?.name}</p>
                                                        <p className="opacity-80">{isER ? (shift.wardId.split('-')[1]) : `Slot ${shift.slotIndex + 1}`}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="technical-card p-6">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Dispatch Assignment</h3>
                        {myAssignments[0] ? (
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <p className="text-[10px] uppercase text-blue-500 font-bold mb-1">Assigned Ward</p>
                                <p className="text-xl font-bold text-blue-900">{staffing.wardMap.get(myAssignments[0].wardId)?.name}</p>
                                <p className="text-xs text-blue-700 mt-4">Rotation: {myAssignments[0].period}</p>
                            </div>
                        ) : (<p className="text-xs text-slate-400 italic py-8 text-center">No active rotation.</p>)}
                    </div>
                    <div className="technical-card p-6">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Unit History</h3>
                        <div className="flex flex-wrap gap-2">{doctor?.previousWards?.map((wId: string) => (<span key={wId} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-200">{staffing.wardMap.get(wId)?.name || wId}</span>)) || <p className="text-xs text-slate-400 italic">None.</p>}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const DashboardView = React.memo(({ staffing, user }: { staffing: any, user: AuthUser }) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [targetPeriod, setTargetPeriod] = useState(currentMonth);
  const myAssignment = staffing.assignments.filter((a: any) => a.doctorIds.includes(user.id)).sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
  const isAdmin = user.role === 'admin';

  const sortedByHours = useMemo(() => {
    if (!isAdmin) return [];
    return staffing.doctors.map((d: Doctor) => ({
        ...d,
        totalHours: staffing.calculateTotalHours(d.id, targetPeriod)
    })).sort((a: any, b: any) => b.totalHours - a.totalHours);
  }, [staffing.doctors, targetPeriod, isAdmin, staffing.calculateTotalHours]);

  const topPerformer = sortedByHours[0];
  const lowPerformer = sortedByHours[sortedByHours.length - 1];

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"><div className="relative z-10"><h2 className="text-2xl font-bold">Hospital Overview</h2><p className="text-blue-100 mt-2 text-sm max-w-lg">{user.role === 'admin' ? "Full Control Mode." : myAssignment ? `Assigned to ${staffing.wardMap.get(myAssignment.wardId)?.name} for ${myAssignment.period}.` : "No active rotation."}</p></div><Hospital className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/10 rotate-12" /></div>
      
      {isAdmin && sortedByHours.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Activity className="w-24 h-24 text-blue-600" /></div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><ArrowLeft className="w-4 h-4 text-blue-600 rotate-90" /> Peak Workload</h3>
                  <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-xl font-bold text-blue-600 border border-blue-100">{topPerformer.name.charAt(0)}</div>
                      <div>
                          <p className="text-lg font-bold text-slate-800">{topPerformer.name}</p>
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded w-fit mt-1">{topPerformer.totalHours} Weighted Hours</p>
                      </div>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Clock className="w-24 h-24 text-green-600" /></div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><ArrowLeft className="w-4 h-4 text-green-600 -rotate-90" /> Lowest Workload</h3>
                  <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-xl font-bold text-green-600 border border-green-100">{lowPerformer.name.charAt(0)}</div>
                      <div>
                          <p className="text-lg font-bold text-slate-800">{lowPerformer.name}</p>
                          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded w-fit mt-1">{lowPerformer.totalHours} Weighted Hours</p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6"><StatCard label="Total Staff" value={staffing.doctors.length} icon={<Users className="w-5 h-5 text-blue-600" />} /><StatCard label="Monthly Wards" value={staffing.wards.length} icon={<Hospital className="w-5 h-5 text-blue-600" />} /><StatCard label="Total Rotations" value={staffing.assignments.length} icon={<Archive className="w-5 h-5 text-blue-600" />} /><StatCard label="Archives" value={new Set(staffing.assignments.map((a: any) => a.period)).size} icon={<Calendar className="w-5 h-5 text-blue-600" />} /></div>
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
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Hierarchy</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.parentWardId || ''} onChange={e => setNewWard(prev => ({ ...prev, parentWardId: e.target.value || undefined }))}><option value="">Main Unit (Stand-alone)</option>{staffing.wards.filter((w: Ward) => w.id !== editingId).map((w: Ward) => (<option key={w.id} value={w.id}>Subordinate to {w.name}</option>))}</select></div>
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

const MonthlyArchiveView = ({ staffing, user, selectedPeriod, onSelect }: { staffing: any, user: AuthUser, selectedPeriod: string | null, onSelect: (m: string | null) => void }) => {
    const [viewMode, setViewMode] = useState<'dispatch' | 'roster'>('dispatch');
    const periods = useMemo(() => [...new Set(staffing.assignments.map((a: Assignment) => a.period))].sort((a, b) => b.localeCompare(a)), [staffing.assignments]);
    if (selectedPeriod) {
        const periodAssignments = staffing.assignments.filter((a: Assignment) => a.period === selectedPeriod);
        const periodShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === selectedPeriod);
        
        // Drag and Drop State
        const [dragSource, setDragSource] = useState<{ type: 'dispatch' | 'roster', wardId: string, doctorId: string, shiftId?: string } | null>(null);

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
                <div className="flex justify-between items-center"><div className="flex items-center gap-4"><button onClick={() => onSelect(null)} className="flex items-center text-xs font-bold text-blue-600 uppercase tracking-widest"><ChevronLeft className="w-4 h-4" /> Archive</button><div className="h-4 w-[1px] bg-slate-200"></div><div className="flex bg-slate-100 p-1 rounded-lg"><button onClick={() => setViewMode('dispatch')} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${viewMode === 'dispatch' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Dispatch Pool</button><button onClick={() => setViewMode('roster')} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${viewMode === 'roster' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Daily Roster</button></div></div><div className="flex gap-2">{user.role === 'admin' && viewMode === 'roster' && (<><button onClick={() => staffing.calculateDailyRoster(selectedPeriod)} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"><RefreshCw className="w-3.5 h-3.5" /> Calculate Shifts</button><button onClick={() => { if(confirm('Purge only daily shifts? Personnel pool will stay.')) staffing.clearRosterByPeriod(selectedPeriod); }} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Purge Roster</button></>)}<button onClick={handleExportDispatch} className="flex items-center gap-2 text-[10px] font-bold uppercase border border-blue-200 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"><Download className="w-3.5 h-3.5" /> Export Dispatch</button><button onClick={handleExportRoster} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"><ListChecks className="w-3.5 h-3.5" /> Export Roster</button></div></div>
                <div className="technical-card overflow-hidden">{viewMode === 'dispatch' ? (
                    <table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Ward Unit</th><th className="col-header">Monthly Personnel Pool (Drag to swap)</th></tr></thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                        {periodAssignments.map((a: Assignment) => (
                            <tr key={a.id}><td className="px-6 py-4 font-semibold text-slate-800">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                    {a.doctorIds.map(id => (
                                        <span key={id} draggable={user.role === 'admin'} 
                                            onDragStart={() => setDragSource({ type: 'dispatch', wardId: a.wardId, doctorId: id })}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={() => {
                                                if (dragSource?.type === 'dispatch' && dragSource.doctorId !== id) {
                                                    staffing.swapPoolDoctors(selectedPeriod, dragSource.wardId, dragSource.doctorId, a.wardId, id);
                                                }
                                                setDragSource(null);
                                            }}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border cursor-move transition-all ${dragSource?.doctorId === id ? 'bg-blue-600 text-white border-blue-700 opacity-50' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:bg-blue-50'}`}>
                                            {staffing.doctorMap.get(id)?.name}
                                        </span>
                                    ))}
                                </div>
                            </td></tr>
                        ))}
                    </tbody></table>
                ) : (
                    <div className="p-0">{periodShifts.length === 0 ? (
                        <div className="p-20 text-center space-y-4"><Calendar className="w-12 h-12 text-slate-200 mx-auto" /><p className="text-slate-400 text-sm">No roster generated yet. Click <b>Calculate Shifts</b>.</p></div>
                    ) : (
                        <div className="max-h-[600px] overflow-auto"><table className="technical-grid border-separate border-spacing-0">
                            <thead><tr className="bg-slate-50 sticky top-0 z-10 shadow-sm"><th className="col-header bg-slate-50">Day</th>{staffing.wards.map(w => (<th key={w.id} className="col-header bg-slate-50 border-l border-slate-100">{w.name}</th>))}</tr></thead>
                            <tbody className="text-xs divide-y divide-slate-100">
                                {[...new Set(periodShifts.map(s => s.day))].sort((a,b)=>a-b).map(day => (
                                    <tr key={day} className="hover:bg-slate-50/50"><td className="px-4 py-3 font-bold text-blue-600 border-r border-slate-100 sticky left-0 bg-white z-20">Day {day}</td>
                                    {staffing.wards.map(w => { 
                                        const shifts = periodShifts.filter(s => s.day === day && s.wardId === w.id); 
                                        return (
                                            <td key={w.id} className="px-4 py-3 border-l border-slate-50">
                                                <div className="space-y-2">
                                                    {shifts.map(s => (
                                                        <div key={s.id} draggable={user.role === 'admin'}
                                                            onDragStart={() => setDragSource({ type: 'roster', wardId: w.id, doctorId: s.doctorId, shiftId: s.id })}
                                                            onDragOver={e => e.preventDefault()}
                                                            onDrop={() => {
                                                                if (dragSource?.type === 'roster' && dragSource.shiftId !== s.id) {
                                                                    staffing.swapShiftDoctors(selectedPeriod, dragSource.shiftId!, s.id);
                                                                }
                                                                setDragSource(null);
                                                            }}
                                                            className={`flex flex-col border-b border-slate-50 pb-1 last:border-0 cursor-move p-1 rounded transition-colors ${dragSource?.shiftId === s.id ? 'bg-blue-600/10 border-blue-200' : 'hover:bg-blue-50'}`}>
                                                            <span className={`text-[10px] font-bold ${dragSource?.shiftId === s.id ? 'text-blue-600' : 'text-slate-800'}`}>{staffing.doctorMap.get(s.doctorId)?.name}</span>
                                                            <span className="text-[8px] text-slate-400 uppercase font-bold">Slot {s.slotIndex + 1} ({w.requirements.shiftDuration})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        ); 
                                    })}</tr>
                                ))}
                            </tbody>
                        </table></div>
                    )}</div>
                )}</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => onSelect(null)} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200"><ChevronLeft className="w-5 h-5" /></button>
                    <div><h2 className="text-xl font-bold text-slate-800">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(selectedPeriod + '-01'))}</h2><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Archived Operational Data</p></div>
                </div>
                {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleExportExcel('ward')} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all"><Download className="w-3.5 h-3.5" /> Ward Excel</button>
                        <button onClick={() => handleExportExcel('er')} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 transition-all"><Download className="w-3.5 h-3.5" /> ER Excel</button>
                        <button onClick={() => { if(confirm('Permanently delete ALL ER CALLS for this period?')) staffing.clearRosterByPeriod(selectedPeriod, true); }} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl hover:bg-red-100 transition-all"><Trash2 className="w-3.5 h-3.5" /> Delete ER</button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-600" /><h3 className="text-xs font-bold uppercase tracking-widest">Ward Shift Log</h3></div>
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white sticky top-0 z-10"><tr className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-100"><th className="p-4">Day</th><th className="p-4">Ward</th><th className="p-4">Personnel</th></tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {wardShifts.sort((a,b)=>a.day-b.day).map((s: ShiftRecord) => (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors text-[11px] font-medium">
                                        <td className="p-4 font-bold text-slate-400">{s.day}</td>
                                        <td className="p-4 text-blue-600">{staffing.wardMap.get(s.wardId)?.name}</td>
                                        <td className="p-4 text-slate-800 font-bold">{staffing.doctorMap.get(s.doctorId)?.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2"><Activity className="w-4 h-4 text-amber-600" /><h3 className="text-xs font-bold uppercase tracking-widest">ER Call Log</h3></div>
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white sticky top-0 z-10"><tr className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-100"><th className="p-4">Day</th><th className="p-4">Dept</th><th className="p-4">Personnel</th></tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {erShifts.sort((a,b)=>a.day-b.day).map((s: ShiftRecord) => (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors text-[11px] font-medium">
                                        <td className="p-4 font-bold text-slate-400">{s.day}</td>
                                        <td className="p-4 text-amber-600">{s.wardId === 'er-referral' ? 'REFERRAL' : s.wardId.replace('er-', '').toUpperCase()}</td>
                                        <td className="p-4 text-slate-800 font-bold">{staffing.doctorMap.get(s.doctorId)?.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

const AssignmentsView = React.memo(({ staffing }: { staffing: any }) => {
    return (<div className="space-y-6"><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h2 className="text-xl font-bold text-slate-800">Dispatch History</h2></div><div className="technical-card overflow-hidden"><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Period</th><th className="col-header">Ward</th><th className="col-header">Personnel Pool</th></tr></thead><tbody className="text-sm divide-y divide-slate-100">{staffing.assignments.slice().reverse().map((a: Assignment) => (<tr key={a.id}><td className="px-6 py-4 text-[10px] font-mono text-blue-600 font-bold uppercase">{a.period}</td><td className="px-6 py-4 font-semibold text-slate-800">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1.5 font-mono text-[9px]">{a.doctorIds.map(id => (<span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">{staffing.doctorMap.get(id)?.name}</span>))}</div></td></tr>))}</tbody></table></div></div>);
});

function NavItem({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) { return (<div onClick={onClick} className={`sidebar-nav-item flex items-center space-x-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><div className={`${active ? 'text-white' : 'text-slate-500'}`}>{icon}</div><span className="text-sm font-medium">{label}</span></div>); }
function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) { return (<div className="bg-white border border-slate-200 rounded-xl p-6 flex items-start justify-between shadow-sm hover:shadow-md transition-shadow"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p><p className="text-3xl font-bold text-slate-900">{value}</p></div><div className="bg-blue-50 p-2.5 rounded-lg">{icon}</div></div>); }
