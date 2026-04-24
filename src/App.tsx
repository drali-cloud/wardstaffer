import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Users, Hospital, ClipboardList, FileUp, Plus, Trash2, Download, Calendar, ChevronRight, UserPlus, Edit2, RefreshCw, Archive, Save, ChevronLeft, User, LogOut, Shield, Clock, MapPin, Lock, Key, X, Check, Activity, ListChecks, ArrowLeft, ArrowRight, Link, CircleCheck, Scale, History, RotateCcw, TriangleAlert, CircleX, Filter, Zap, Settings, Database, UploadCloud, AlertOctagon, ArrowRightLeft, UsersRound, Palette, Power, PowerOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStaffingData } from './hooks/useStaffingData';
import { Doctor, Ward, Gender, Assignment, ShiftRecord, AuditLog, ShiftExchange, Team } from './types';
import * as XLSX from 'xlsx';

type View = 'dashboard' | 'doctors' | 'wards' | 'archive' | 'assignments' | 'profile' | 'calendar' | 'equity' | 'er_calls' | 'settings' | 'exchange';

const getSlotName = (slotIdx: number, wardId: string = '') => {
    if (wardId === 'referral') return '24h Call';
    if (wardId === 'er-pediatric') {
        if (slotIdx === 0) return 'Morning';
        if (slotIdx === 1) return 'Post Morning';
        return 'Night';
    }
    if (wardId.startsWith('er-')) {
        switch (slotIdx) {
            case 0: return 'Morning';
            case 1: return 'Post Morning';
            case 2: return 'Pre Night';
            case 3: return 'Night';
            default: return `Slot ${slotIdx + 1}`;
        }
    }
    return `Slot ${slotIdx + 1}`;
};
type Role = 'resident' | 'admin';

interface AuthUser {
    id: string;
    name: string;
    role: Role;
}

export default function App() {
    const [user, setUser] = useState<AuthUser | null>(() => {
        try {
            const saved = localStorage.getItem('wardstaffer_user');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error('Failed to parse saved user:', e);
            return null;
        }
    });
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
    const staffing = useStaffingData();

    const [viewingDoctorId, setViewingDoctorId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navigateToDoctor = (id: string) => {
        setViewingDoctorId(id);
        setCurrentView('profile');
        setSidebarOpen(false);
    };

    useEffect(() => {
        if (user) localStorage.setItem('wardstaffer_user', JSON.stringify(user));
        else localStorage.removeItem('wardstaffer_user');
    }, [user]);

    const handleLogin = React.useCallback(async (name: string, pass: string) => {
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password: pass })
            });
            if (!res.ok) return false;
            const user = await res.json();
            setUser(user);
            return true;
        } catch (e) {
            console.error('Login error:', e);
            return false;
        }
    }, []);

    const handleLogout = () => { setUser(null); setCurrentView('dashboard'); setViewingDoctorId(null); };

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
                    <NavItem active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setViewingDoctorId(null); setSidebarOpen(false); }} label="Overview" icon={<ClipboardList className="w-4 h-4" />} />
                    <NavItem active={currentView === 'profile' && !viewingDoctorId} onClick={() => { setCurrentView('profile'); setViewingDoctorId(null); setSidebarOpen(false); }} label="My Profile" icon={<User className="w-4 h-4" />} />
                    <div className="h-px bg-slate-800 my-4"></div>
                    <NavItem active={currentView === 'doctors'} onClick={() => { setCurrentView('doctors'); setSidebarOpen(false); }} label="Staff Registry" icon={<Users className="w-4 h-4" />} />
                    <NavItem active={currentView === 'wards'} onClick={() => { setCurrentView('wards'); setSidebarOpen(false); }} label="Ward Config" icon={<Hospital className="w-4 h-4" />} />
                    <NavItem active={currentView === 'calendar'} onClick={() => { setCurrentView('calendar'); setSidebarOpen(false); }} label="Shift Calendar" icon={<Calendar className="w-4 h-4" />} />
                    <NavItem active={currentView === 'er_calls'} onClick={() => { setCurrentView('er_calls'); setSidebarOpen(false); }} label="ER On-Call" icon={<Activity className="w-4 h-4 text-amber-500" />} />
                    <NavItem active={currentView === 'archive'} onClick={() => { setCurrentView('archive'); setSelectedPeriod(null); setSidebarOpen(false); }} label="Archives & Roster" icon={<Archive className="w-4 h-4" />} />
                    <NavItem active={currentView === 'exchange'} onClick={() => { setCurrentView('exchange'); setSidebarOpen(false); }} label="Shift Exchange" icon={<ArrowRightLeft className="w-4 h-4 text-emerald-500" />} />
                    {user.role === 'admin' && <NavItem active={currentView === 'equity'} onClick={() => { setCurrentView('equity'); setSidebarOpen(false); }} label="Equity Engine" icon={<Scale className="w-4 h-4 text-blue-400" />} />}
                    {user.role === 'admin' && <NavItem active={currentView === 'settings'} onClick={() => { setCurrentView('settings'); setSidebarOpen(false); }} label="Control Panel" icon={<Settings className="w-4 h-4 text-slate-400" />} />}
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
                        <h1 className="text-sm lg:text-lg font-semibold text-slate-800 capitalize truncate">{currentView === 'profile' && viewingDoctorId ? 'Clinician Profile' : currentView.replace('_', ' ')}</h1>
                        <div className="hidden sm:block h-4 w-[1px] bg-slate-200"></div>
                        <div className="hidden sm:flex items-center text-[10px] text-slate-400 uppercase font-bold tracking-wider"><span>{user.role}</span><ChevronRight className="w-3 h-3" /> <span className="text-blue-600">{currentView === 'profile' && viewingDoctorId ? 'Clinician Profile' : currentView.replace('_', ' ')}</span></div>
                    </div>
                    {staffing.syncing && (<div className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /><span>Syncing...</span></div>)}
                </header>
                <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50">
                    <div className="max-w-7xl mx-auto">
                        <AnimatePresence mode="wait">
                            <motion.div key={currentView + viewingDoctorId + (selectedPeriod || '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                                {currentView === 'dashboard' && <DashboardView staffing={staffing} user={user} onNavigate={navigateToDoctor} onNavigateToSettings={() => setCurrentView('settings')} />}
                                {currentView === 'calendar' && <ShiftCalendarView staffing={staffing} onNavigate={navigateToDoctor} />}
                                {currentView === 'er_calls' && <ERCallsView staffing={staffing} user={user!} onNavigate={navigateToDoctor} />}
                                {currentView === 'doctors' && <DoctorsView staffing={staffing} user={user} onNavigate={navigateToDoctor} />}
                                {currentView === 'wards' && <WardsView staffing={staffing} user={user} onNavigate={navigateToDoctor} />}
                                {currentView === 'archive' && <MonthlyArchiveView staffing={staffing} user={user} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} onNavigate={navigateToDoctor} />}
                                {currentView === 'assignments' && <AssignmentsView staffing={staffing} />}
                                {currentView === 'profile' && <ProfileView staffing={staffing} user={user} targetDoctorId={viewingDoctorId} />}
                                {currentView === 'equity' && <EquityView staffing={staffing} onNavigate={navigateToDoctor} />}
                                {currentView === 'exchange' && <ShiftExchangeView staffing={staffing} user={user} />}
                                {currentView === 'settings' && <ControlPanelView staffing={staffing} />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </main>
        </div>
    );
}

function NavItem({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
    return (
        <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
            {icon} <span>{label}</span>
        </button>
    );
}

function AvatarPopup({ doctor, onNavigate, colorClass = "bg-blue-100 text-blue-600 hover:bg-blue-600", borderClass = "border-white ring-slate-100", sizeClass = "w-10 h-10" }: any) {
    const [open, setOpen] = useState(false);
    if (!doctor) return <div className={`${sizeClass} rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-slate-300 bg-slate-50 border-slate-100`}>?</div>;
    return (
        <div
            className="relative"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => {
                e.stopPropagation();
                if (!open && window.innerWidth < 768) {
                    setOpen(true);
                    setTimeout(() => setOpen(false), 2500);
                } else {
                    onNavigate(doctor.id);
                }
            }}
        >
            <div className={`${sizeClass} rounded-full border-2 flex items-center justify-center text-xs font-bold cursor-pointer transition-all ring-1 hover:text-white ${colorClass} ${borderClass}`}>
                {doctor.name.charAt(0)}
            </div>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2.5 bg-slate-900 text-white rounded-xl shadow-xl z-50 pointer-events-none whitespace-nowrap border border-slate-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider">{doctor.name}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5">Click/Tap to view profile</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const ShiftCalendarView = React.memo(({ staffing, onNavigate, archivePeriod }: { staffing: any, onNavigate: (id: string) => void, archivePeriod?: string }) => {
    const [viewDate, setViewDate] = useState(archivePeriod ? new Date(archivePeriod + '-02') : new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null);
    const isAdmin = !archivePeriod; // Assuming admin access for active periods
    const period = archivePeriod || `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const targetDate = archivePeriod ? new Date(archivePeriod + '-02') : viewDate;
    const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    const firstDayIdx = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getDay();
    const periodShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period);

    const prevMonth = () => { if (!archivePeriod) setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)); };
    const nextMonth = () => { if (!archivePeriod) setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)); };

    const handleExportRoster = () => {
        if (periodShifts.length === 0) { alert('Generate roster first.'); return; }
        const wb = XLSX.utils.book_new();
        const days = [...new Set(periodShifts.map(s => s.day))].sort((a, b) => a - b);
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
            {!archivePeriod && (
                <>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Calendar className="w-6 h-6" /></div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}</h2>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Shift Operations Center</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"><ArrowLeft className="w-4 h-4" /></button>
                            <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"><ArrowRight className="w-4 h-4" /></button>
                        </div>
                    </div>

                    <div className="technical-card p-6 border-blue-100 ring-1 ring-blue-50 flex items-center justify-between gap-8">
                        <div>
                            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-600" /> Roster Operations</h2>
                            <p className="text-xs text-slate-400">Calculate or export the daily shift schedule for this period.</p>
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => {
                                    if (confirm('Generate a team-based ward roster? This will coordinate with your ER call teams and ensure equal shifts. Existing ward shifts will be replaced.')) {
                                        staffing.calculateTeamWardRoster(period);
                                    }
                                }} 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                            >
                                <UsersRound className="w-4 h-4" /> Team-Based Shifts
                            </button>
                            <button onClick={() => staffing.calculateDailyRoster(period)} className="btn-primary px-8 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Balanced Roster</button>
                            <button onClick={() => { if (confirm('Clear all shifts for this month? Personnel assignments will be kept.')) staffing.clearRosterByPeriod(period); }} className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2"><Trash2 className="w-4 h-4" /> Clear Roster</button>
                            <button onClick={handleExportRoster} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2"><Download className="w-4 h-4" /> Export Roster</button>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2"><UsersRound className="w-3.5 h-3.5 text-indigo-600" /> Source Teams (Drag to Daily Report)</h3>
                        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-2">
                            {staffing.teams.map((t: Team) => (
                                <div key={t.id} draggable={isAdmin} onDragStart={() => setDraggedTeamId(t.id)} className={`px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-[10px] font-bold text-indigo-600 ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-indigo-400' : ''} transition-all whitespace-nowrap shadow-sm`}>{t.name}</div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (<div key={d} className="bg-slate-50 p-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>))}
                {Array.from({ length: firstDayIdx }).map((_, i) => <div key={`empty-${i}`} className="bg-slate-50/50 min-h-[70px]" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayShifts = periodShifts.filter((s: ShiftRecord) => s.day === day);
                    const dayShiftsCount = dayShifts.length;
                    const referralShift = dayShifts.find(s => s.wardId === 'referral');

                    return (
                        <div key={day} onClick={() => setSelectedDay(day)} className={`bg-white p-2 min-h-[90px] cursor-pointer hover:bg-blue-50 transition-all border-b border-r border-slate-100 group relative ${selectedDay === day ? 'ring-2 ring-blue-500 z-10' : ''}`}>
                            <span className={`text-xs font-bold ${day === new Date().getDate() && viewDate.getMonth() === new Date().getMonth() ? 'w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center' : 'text-slate-700'}`}>{day}</span>
                            {dayShiftsCount > 0 && (
                                <div className="mt-2 space-y-1">
                                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /><span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{dayShiftsCount} Slots</span></div>
                                    {referralShift && (
                                        <div className="p-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-[4px] text-[7px] font-black uppercase truncate leading-tight">
                                            REF: {staffing.doctorMap.get(referralShift.doctorId)?.name}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-0.5 mt-1">{dayShifts.slice(0, 5).map((s: ShiftRecord) => (<div key={s.id} className="w-0.5 h-2.5 bg-blue-100 rounded-full" />))}</div>
                                </div>
                            )}
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
                                {staffing.wards.filter((w: Ward) => {
                                    if (w.hiddenFromCalendar) return false;
                                    if (w.parentWardId && staffing.wardMap.get(w.parentWardId)?.hiddenFromCalendar) return false;
                                    return true;
                                }).map((w: Ward) => {
                                    const dayShifts = periodShifts.filter((s: ShiftRecord) => s.day === selectedDay && s.wardId === w.id);
                                    return (
                                        <div key={w.id} 
                                            onDragOver={e => isAdmin && e.preventDefault()}
                                            onDrop={() => {
                                                if (draggedTeamId && isAdmin) {
                                                    staffing.assignTeamToWardDay(period, selectedDay, w.id, draggedTeamId);
                                                    setDraggedTeamId(null);
                                                }
                                            }}
                                            className={`p-4 bg-slate-50 rounded-2xl border ${draggedTeamId ? 'border-dashed border-indigo-400 bg-indigo-50/30' : 'border-slate-100'} flex items-center justify-between group hover:border-blue-200 transition-all`}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"><Hospital className="w-5 h-5" /></div>
                                                <div><p className="text-sm font-bold text-slate-800">{w.name}</p><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{w.requirements.shiftDuration} Pattern</p></div>
                                            </div>
                                            <div className="flex -space-x-2">
                                                {dayShifts.map((s: ShiftRecord) => (
                                                    <AvatarPopup key={s.id} doctor={staffing.doctorMap.get(s.doctorId)} onNavigate={onNavigate} />
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
});

const ERCallsView = React.memo(({ staffing, user, onNavigate, archivePeriod }: { staffing: any, user: AuthUser, onNavigate: (id: string) => void, archivePeriod?: string }) => {
    const [viewDate, setViewDate] = useState(archivePeriod ? new Date(archivePeriod + '-02') : new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [dragSourceWard, setDragSourceWard] = useState<string | null>(null);
    const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null);
    const [draggedShift, setDraggedShift] = useState<ShiftRecord | null>(null);
    const isAdmin = !archivePeriod && user.role === 'admin';

    const period = archivePeriod || `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const targetDate = archivePeriod ? new Date(archivePeriod + '-02') : viewDate;
    const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    const firstDayIdx = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getDay();

    const deactivatedDays = staffing.erConfig.deactivatedDays?.[period] || [];
    const erShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period && (s.wardId.startsWith('er-') || s.wardId === 'referral'));

    const toggleDayActivation = (day: number) => {
        if (!isAdmin) return;
        const currentDeactivated = staffing.erConfig.deactivatedDays?.[period] || [];
        const newDeactivated = currentDeactivated.includes(day)
            ? currentDeactivated.filter((d: number) => d !== day)
            : [...currentDeactivated, day];
        
        const newConfig = {
            ...staffing.erConfig,
            deactivatedDays: {
                ...(staffing.erConfig.deactivatedDays || {}),
                [period]: newDeactivated
            }
        };
        staffing.updateERConfig(newConfig);
    };

    const handleDropOnDay = async (day: number) => {
        if (deactivatedDays.includes(day)) return;
        if (draggedTeamId && isAdmin) {
            await staffing.assignTeamToERDay(period, day, draggedTeamId);
            setDraggedTeamId(null);
            return;
        }
        if (!draggedShift || !isAdmin || draggedShift.day === day) return;
        // Simple case: swap with someone in the SAME slot on another day
        const targetShift = erShifts.find(s => s.day === day && s.wardId === draggedShift.wardId && s.slotIndex === draggedShift.slotIndex);
        if (targetShift) {
            await staffing.swapERCalls(period, draggedShift, targetShift);
            setDraggedShift(null);
        } else {
            alert('Target slot empty or mismatch. Manual swap requires an existing counterpart.');
        }
    };

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
            {!archivePeriod && (
                <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-amber-50 p-2 md:p-3 rounded-xl text-amber-600"><Activity className="w-5 h-5 md:w-6 md:h-6" /></div>
                        <div><h2 className="text-lg md:text-xl font-bold text-slate-800 leading-none">ER Call Center</h2><p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Operational Duty Control</p></div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-2">
                        <div className="flex gap-1"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"><ArrowLeft className="w-4 h-4" /></button><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"><ArrowRight className="w-4 h-4" /></button></div>
                        {isAdmin && (
                            <>
                                <button 
                                    onClick={() => {
                                        const weekends: number[] = [];
                                        for (let d = 1; d <= daysInMonth; d++) {
                                            const dayDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), d);
                                            if (dayDate.getDay() === 0 || dayDate.getDay() === 6) weekends.push(d);
                                        }
                                        const newConfig = {
                                            ...staffing.erConfig,
                                            deactivatedDays: {
                                                ...(staffing.erConfig.deactivatedDays || {}),
                                                [period]: [...new Set([...(staffing.erConfig.deactivatedDays?.[period] || []), ...weekends])]
                                            }
                                        };
                                        staffing.updateERConfig(newConfig);
                                    }}
                                    className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-all"
                                >
                                    <PowerOff className="w-3.5 h-3.5" /> Deactivate Weekends
                                </button>
                                <button 
                                    onClick={() => {
                                        if (confirm('Generate a team-based round-robin roster? Existing ER shifts for this month will be replaced.')) {
                                            staffing.calculateTeamRoundRobinERCalls(period);
                                        }
                                    }}
                                    className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
                                >
                                    <UsersRound className="w-3.5 h-3.5" /> Team Round-Robin
                                </button>
                                <button onClick={() => staffing.calculateERCalls(period, staffing.erConfig)} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-[10px] font-bold uppercase bg-amber-600 text-white px-4 py-2.5 rounded-xl hover:bg-amber-700 shadow-lg shadow-amber-600/20 transition-all"><RefreshCw className="w-3.5 h-3.5" /> Calculate Equity</button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2"><Hospital className="w-3.5 h-3.5 text-blue-600" /> Source Units</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                            {staffing.wards.map((w: Ward) => (
                                <div key={w.id} draggable={isAdmin} onDragStart={() => setDragSourceWard(w.id)} className={`px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold text-slate-600 ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-blue-400' : ''} transition-all`}>{w.name}</div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2"><UsersRound className="w-3.5 h-3.5 text-indigo-600" /> Clinical Teams</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                            {staffing.teams.map((t: Team) => (
                                <div key={t.id} draggable={isAdmin} onDragStart={() => setDraggedTeamId(t.id)} className={`px-2 py-1 bg-indigo-50 border border-indigo-200 rounded text-[9px] font-bold text-indigo-600 ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-indigo-400' : ''} transition-all`}>{t.name}</div>
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
                    const isDeactivated = deactivatedDays.includes(day);
                    const dayShifts = erShifts.filter((s: ShiftRecord) => s.day === day);
                    return (
                        <div key={day}
                            onDragOver={e => isAdmin && e.preventDefault()}
                            onDrop={() => isAdmin && handleDropOnDay(day)}
                            className={`bg-white p-2 min-h-[90px] transition-all border-b border-r border-slate-100 group relative ${isDeactivated ? 'bg-slate-50 opacity-60' : 'hover:bg-amber-50'}`}>
                            <div className="flex justify-between items-start">
                                <span className={`text-xs font-bold ${isDeactivated ? 'text-slate-300' : 'text-slate-400'}`}>{day}</span>
                                {isAdmin && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleDayActivation(day); }}
                                        title={isDeactivated ? "Activate Day" : "Deactivate Day"}
                                        className={`p-1.5 rounded-lg transition-all shadow-sm flex items-center justify-center ${isDeactivated ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-slate-100 text-slate-400 hover:text-green-600 hover:bg-green-50 hover:ring-1 hover:ring-green-200'}`}
                                    >
                                        {isDeactivated ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 space-y-1 cursor-pointer" onClick={() => !isDeactivated && setSelectedDay(day)}>
                                {dayShifts.length > 0 && !isDeactivated && (
                                    <>
                                        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /><span className="text-[8px] font-bold text-slate-500 uppercase">{dayShifts.length} Active Slots</span></div>
                                        <div className="flex gap-0.5">{dayShifts.map(s => <div key={s.id} className={`w-1 h-2 rounded-full ${s.wardId === 'er-pediatric' ? 'bg-green-400' : s.wardId === 'er-women' ? 'bg-pink-400' : s.wardId === 'referral' ? 'bg-indigo-400' : 'bg-blue-400'}`} />)}</div>
                                    </>
                                )}
                                {isDeactivated && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] font-black text-slate-200 uppercase tracking-tighter rotate-12">Inactive</span>
                                    </div>
                                )}
                            </div>
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
                                {/* ER category columns use labels from erConfig if set */}
                                {(() => {
                                    const cfg = staffing.erConfig;
                                    const defLabels = {
                                        men: ['08:00 - 14:00', '14:00 - 20:00', '20:00 - 02:00', '02:00 - 08:00'],
                                        women: ['08:00 - 14:00', '14:00 - 20:00', '20:00 - 02:00', '02:00 - 08:00'],
                                        pediatric: ['08:00 - 16:00', '16:00 - 00:00', '00:00 - 08:00'],
                                        referral: ['24-Hour Duty Rotation']
                                    };
                                    const lbls = cfg?.slotLabels || defLabels;
                                    return (<>
                                        <ERModalColumn title="Men" wardId="er-men" day={selectedDay} period={period} staffing={staffing} color="blue" slots={lbls.men || defLabels.men} onNavigate={onNavigate} onClose={() => setSelectedDay(null)} onDragShift={setDraggedShift} draggedShift={draggedShift} erConfig={cfg} />
                                        <ERModalColumn title="Women" wardId="er-women" day={selectedDay} period={period} staffing={staffing} color="pink" slots={lbls.women || defLabels.women} onNavigate={onNavigate} onClose={() => setSelectedDay(null)} onDragShift={setDraggedShift} draggedShift={draggedShift} erConfig={cfg} />
                                        <ERModalColumn title="Pediatric" wardId="er-pediatric" day={selectedDay} period={period} staffing={staffing} color="green" slots={lbls.pediatric || defLabels.pediatric} onNavigate={onNavigate} onClose={() => setSelectedDay(null)} onDragShift={setDraggedShift} draggedShift={draggedShift} erConfig={cfg} />
                                        <ERModalColumn title="Daily Referral" wardId="referral" day={selectedDay} period={period} staffing={staffing} color="indigo" slots={lbls.referral || defLabels.referral} onNavigate={onNavigate} onClose={() => setSelectedDay(null)} onDragShift={setDraggedShift} draggedShift={draggedShift} erConfig={cfg} />
                                    </>);
                                })()}
                            </div>
                            <div className="p-5 md:p-6 bg-white border-t border-slate-100 flex-shrink-0"><button onClick={() => setSelectedDay(null)} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-sm uppercase tracking-widest">Finish Review</button></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

function ERModalColumn({ title, wardId, day, period, staffing, color, slots, erConfig, onNavigate, onClose, onDragShift, draggedShift }: { title: string, wardId: string, day: number, period: string, staffing: any, color: 'blue' | 'pink' | 'green' | 'indigo', slots: string[], erConfig: any, onNavigate: (id: string) => void, onClose: () => void, onDragShift: (s: ShiftRecord | null) => void, draggedShift: ShiftRecord | null }) {
    const dayShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period && s.day === day && s.wardId === wardId);
    const colors: any = { blue: 'text-blue-600 bg-blue-50 border-blue-100', pink: 'text-pink-600 bg-pink-50 border-pink-100', green: 'text-green-600 bg-green-50 border-green-100', indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100' };

    // Derive slot capacity from erConfig, falling back to hardcoded defaults
    const defaultSlots = { referral: [1], men: [2, 4, 4, 2], women: [2, 4, 4, 2], pediatric: [1, 1, 1] };
    const configSlots = erConfig?.slots || defaultSlots;
    const catKey = wardId === 'referral' ? 'referral' : wardId.replace('er-', '') as keyof typeof defaultSlots;
    const slotCapacities: number[] = configSlots[catKey] || defaultSlots[catKey] || [1];

    return (
        <div className="space-y-4">
            <h4 className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit ${colors[color]}`}>{title} Department</h4>
            <div className="space-y-3">
                {slots.map((time, idx) => {
                    const slotShifts = dayShifts.filter(s => s.slotIndex === idx);
                    const slotCount = slotCapacities[idx] ?? 1;
                    return (
                        <div key={idx}
                            onDragOver={e => e.preventDefault()}
                            onDrop={async () => {
                                if (!draggedShift) return;
                                const targetShift = slotShifts[0];
                                if (targetShift && targetShift.id !== draggedShift.id) {
                                    await staffing.swapERCalls(period, draggedShift, targetShift);
                                    onDragShift(null);
                                }
                            }}
                            className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm group hover:border-blue-200 transition-all">
                            <p className="text-[8px] font-bold text-slate-400 uppercase mb-2 flex justify-between">
                                <span>{time}</span>
                                <span className="text-blue-600">{getSlotName(idx, wardId)}</span>
                            </p>
                            <div className="space-y-2">
                                {Array.from({ length: slotCount }).map((_, sIdx) => {
                                    const shift = slotShifts[sIdx];
                                    const badgeColor = shift ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-400';
                                    const roleLabel = wardId === 'referral' ? 'External Referral' : 'General ER';

                                    return (
                                        <div key={sIdx}
                                            draggable={!!shift}
                                            onDragStart={() => shift && onDragShift(shift)}
                                            className={`flex flex-col p-1.5 rounded-lg border ${badgeColor} ${shift ? 'cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors' : ''}`}
                                            onClick={() => { if (shift) { onNavigate(shift.doctorId); onClose(); } }}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[7px] uppercase font-black tracking-tighter opacity-70">{roleLabel} #{sIdx + 1}</span>
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

function LoginPage({ onLogin }: { onLogin: (u: string, p: string) => Promise<boolean>, isLoading?: boolean }) {
    const [name, setName] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-8 space-y-8">
                <div className="text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Hospital className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">WardStaffer Portal</h1>
                    <p className="text-slate-500 text-sm mt-2">Monthly Clinical Dispatch</p>
                </div>
                <form onSubmit={async e => {
                    e.preventDefault();
                    if (!name.trim() || !pass) { setError('Please enter your name and password.'); return; }
                    setSubmitting(true);
                    setError('');
                    try {
                        const success = await onLogin(name.trim(), pass);
                        if (!success) setError('Invalid physician name or security key.');
                    } finally {
                        setSubmitting(false);
                    }
                }} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold text-center">
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medical Staff Name</label>
                        <div className="relative flex items-center group">
                            <User className="absolute left-4 w-5 h-5 text-slate-500 pointer-events-none transition-colors group-focus-within:text-blue-600" />
                            <input
                                type="text"
                                placeholder="Full Registered Name"
                                className="w-full bg-white border border-slate-200 text-slate-950 rounded-xl py-3.5 px-12 text-sm text-center focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm font-medium"
                                value={name}
                                onChange={e => { setName(e.target.value); setError(''); }}
                                disabled={submitting}
                                autoComplete="username"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Security Access Key</label>
                        <div className="relative flex items-center group">
                            <Lock className="absolute left-4 w-5 h-5 text-slate-500 pointer-events-none transition-colors group-focus-within:text-blue-600" />
                            <input
                                type="password"
                                placeholder="Enter your password"
                                className="w-full bg-white border border-slate-200 text-slate-950 rounded-xl py-3.5 px-12 text-sm text-center focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm font-medium"
                                value={pass}
                                onChange={e => { setPass(e.target.value); setError(''); }}
                                disabled={submitting}
                                autoComplete="current-password"
                            />
                        </div>
                        <p className="text-[10px] text-slate-600 text-center pt-1">Default password: <span className="font-bold text-slate-500">11111111</span></p>
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {submitting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...</>) : 'Authenticate & Access'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const ProfileView = React.memo(({ staffing, user, targetDoctorId }: { staffing: any, user: AuthUser, targetDoctorId: string | null }) => {
    const isSelf = !targetDoctorId || targetDoctorId === user.id;
    const effectiveId = targetDoctorId || user.id;
    const doctor = staffing.doctors.find((d: any) => d.id === effectiveId);
    if (!doctor) return <div className="p-12 text-center text-slate-400">Physician record not found.</div>;

    const myAssignments = staffing.assignments.filter((a: any) => a.doctorIds.includes(effectiveId)).sort((a: any, b: any) => b.period.localeCompare(a.period));
    const [viewDate, setViewDate] = useState(new Date());
    const period = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const myShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period && s.doctorId === effectiveId);

    const durations = staffing.erConfig?.durations || { referral: 24, men: 6, women: 6, pediatric: 8 };
    const isERShift = (s: ShiftRecord) => s.wardId.startsWith('er-') || s.wardId === 'referral';
    const erHours = myShifts.filter((s: ShiftRecord) => isERShift(s)).reduce((sum: number, s: ShiftRecord) => {
        if (s.wardId === 'referral') return sum + (durations.referral ?? 24);
        if (s.wardId === 'er-men') return sum + (durations.men ?? 6);
        if (s.wardId === 'er-women') return sum + (durations.women ?? 6);
        if (s.wardId === 'er-pediatric') return sum + (durations.pediatric ?? 8);
        return sum + 12;
    }, 0);
    const wardHours = myShifts.filter((s: ShiftRecord) => !isERShift(s)).reduce((sum: number, s: ShiftRecord) => {
        const ward = staffing.wardMap.get(s.wardId);
        if (ward?.requirements?.shiftWeight !== undefined) return sum + ward.requirements.shiftWeight;
        const duration = ward?.requirements?.shiftDuration;
        return sum + (duration === '6h' ? 6 : duration === '12h' ? 12 : 24);
    }, 0);
    const totalHours = erHours + wardHours;
    const erPercent = totalHours > 0 ? (erHours / totalHours) * 100 : 0;

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayIdx = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

    const [newPass, setNewPass] = useState('');
    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1 space-y-6">
                    <div className="flex items-center space-x-6">
                        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl font-bold text-blue-600 border border-blue-100">{doctor.name.charAt(0)}</div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{doctor.name}</h2>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-full">ID: {doctor.id}</span>
                                <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${(doctor.role === 'admin' || doctor.id === 'root') ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'}`}>Role: {(doctor.role === 'admin' || doctor.id === 'root') ? 'Admin' : 'Resident'}</span>
                                <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold uppercase rounded-full border border-amber-100">{totalHours} Weighted Hours</span>
                            </div>
                        </div>
                    </div>
                    {totalHours > 0 && (
                        <div className="max-w-md bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 mb-2">
                                <span>Ward: {wardHours}h</span>
                                <span>ER Call: {erHours}h</span>
                            </div>
                            <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200">
                                <div className="h-full bg-blue-500 transition-all" style={{ width: `${100 - erPercent}%` }} />
                                <div className="h-full bg-amber-500 transition-all" style={{ width: `${erPercent}%` }} />
                            </div>
                        </div>
                    )}
                </div>
                {isSelf && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 w-full md:w-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Update Security Key</label>
                        <div className="flex gap-2">
                            <input type="password" placeholder="New Key" value={newPass} onChange={e => setNewPass(e.target.value)} className="text-xs p-2 rounded-lg border border-slate-200 flex-1" />
                            <button onClick={() => { if (!newPass.trim()) return; staffing.updateDoctor({ ...doctor, password: newPass }); setNewPass(''); alert('Security Key Updated.'); }} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Key className="w-4 h-4" /></button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3"><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Calendar className="w-5 h-5" /></div><div><h3 className="text-sm font-bold text-slate-800">Operational Duty Calendar</h3><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}</p></div></div>
                            <div className="flex gap-1"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-50 rounded border border-slate-200"><ArrowLeft className="w-3.5 h-3.5" /></button><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-50 rounded border border-slate-200"><ArrowRight className="w-3.5 h-3.5" /></button></div>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (<div key={d} className="bg-slate-50/50 p-2 text-center text-[9px] font-bold text-slate-400">{d}</div>))}
                            {Array.from({ length: firstDayIdx }).map((_, i) => <div key={`e-${i}`} className="bg-white" />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const d = i + 1;
                                const shifts = myShifts.filter((s: ShiftRecord) => s.day === d);
                                return (
                                    <div key={d} className={`min-h-[70px] p-1 border-t border-l border-slate-50 relative ${shifts.length > 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                                        <span className={`text-[9px] font-bold ${shifts.length > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{d}</span>
                                        <div className="mt-1 space-y-1">
                                            {shifts.map(shift => {
                                                const ward = staffing.wardMap.get(shift.wardId);
                                                const isER = shift.wardId.startsWith('er-') || shift.wardId === 'referral';
                                                return (
                                                    <div key={shift.id} className={`p-1.5 rounded-lg text-[7px] font-black uppercase leading-tight shadow-sm border ${isER ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-600 text-white border-blue-700'}`}>
                                                        <p className="truncate">{ward?.name || 'Unknown Unit'}</p>
                                                        <p className={`${isER ? 'text-amber-500' : 'text-blue-200'} text-[6px]`}>{isER ? getSlotName(shift.slotIndex, shift.wardId) : `Slot ${shift.slotIndex + 1}`}</p>
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
                                <p className="text-[10px] uppercase text-blue-500 font-bold mb-1">Primary Unit</p>
                                <p className="text-xl font-bold text-blue-900">{staffing.wardMap.get(myAssignments[0].wardId)?.name}</p>
                                <p className="text-xs text-blue-700 mt-4">Rotation Cycle: {myAssignments[0].period}</p>
                            </div>
                        ) : (<p className="text-xs text-slate-400 italic py-8 text-center">No active rotation in this cycle.</p>)}
                    </div>
                    <div className="technical-card p-6">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Rotation History</h3>
                        <div className="flex flex-wrap gap-2">{doctor?.previousWards?.map((wId: string) => (<span key={wId} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-200">{staffing.wardMap.get(wId)?.name || wId}</span>)) || <p className="text-xs text-slate-400 italic">None recorded.</p>}</div>
                    </div>
                </div>
            </div>
        </div>
    );
});

const DashboardView = React.memo(({ staffing, user, onNavigate, onNavigateToSettings }: { staffing: any, user: AuthUser, onNavigate: (id: string) => void, onNavigateToSettings: () => void }) => {
    const myAssignment = staffing.assignments.filter((a: any) => a.doctorIds.includes(user.id)).sort((a: any, b: any) => b.period.localeCompare(a.period))[0];
    const isAdmin = user.role === 'admin';
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentDay = new Date().getDate();
    const [generatePeriod, setGeneratePeriod] = useState(currentMonth);

    const upcomingShifts = useMemo(() => {
        if (isAdmin) return [];
        return staffing.shifts
            .filter((s: ShiftRecord) => s.doctorId === user.id && s.period === currentMonth && s.day >= currentDay)
            .sort((a: any, b: any) => a.day - b.day)
            .slice(0, 4);
    }, [staffing.shifts, user.id, isAdmin, currentMonth, currentDay]);

    return (
        <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">Hospital Overview</h2>
                        <p className="text-blue-100 mt-2 text-sm max-w-lg">{user.role === 'admin' ? "Full Control Mode." : myAssignment ? `Assigned to ${staffing.wardMap.get(myAssignment.wardId)?.name} for ${myAssignment.period}.` : "No active rotation."}</p>
                    </div>
                    {user.role === 'admin' && (
                        <button onClick={onNavigateToSettings} className="bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 px-6 rounded-xl backdrop-blur-sm transition-all flex items-center gap-2 text-sm shadow-lg border border-white/10">
                            <Settings className="w-4 h-4" /> Master Control Panel
                        </button>
                    )}
                </div>
                <Hospital className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/10 rotate-12 pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6"><StatCard label="Total Staff" value={staffing.doctors.filter((d: Doctor) => d.id !== 'root').length} icon={<Users className="w-5 h-5 text-blue-600" />} /><StatCard label="Monthly Wards" value={staffing.wards.length} icon={<Hospital className="w-5 h-5 text-blue-600" />} /><StatCard label="Total Rotations" value={staffing.assignments.length} icon={<Archive className="w-5 h-5 text-blue-600" />} /><StatCard label="Archives" value={new Set(staffing.assignments.map((a: any) => a.period)).size} icon={<Calendar className="w-5 h-5 text-blue-600" />} /></div>

            {!isAdmin && upcomingShifts.length > 0 && (
                <div className="technical-card p-6">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> My Upcoming Shifts ({currentMonth})</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {upcomingShifts.map((s: ShiftRecord) => {
                            const isER = s.wardId.startsWith('er-');
                            return (
                                <div key={s.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm hover:border-blue-300 transition-colors">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-black text-slate-400">DAY {s.day}</span>
                                        {isER ? <Activity className="w-4 h-4 text-amber-500" /> : <Hospital className="w-4 h-4 text-blue-500" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 line-clamp-1">{isER ? s.wardId.replace('er-', '').toUpperCase() : staffing.wardMap.get(s.wardId)?.name}</p>
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mt-1">{isER ? 'ER Call' : `Slot ${s.slotIndex + 1}`}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {user.role === 'admin' && (
                <div className="technical-card p-8 border-blue-100 ring-1 ring-blue-50 flex items-center justify-between gap-8">
                    <div>
                        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2"><Save className="w-4 h-4 text-blue-600" /> Monthly Dispatch Generator</h2>
                        <p className="text-xs text-slate-400">Initialize the personnel pool for each ward for the next rotation cycle.</p>
                    </div>
                    <div className="flex gap-4">
                        <input type="month" className="text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl" value={generatePeriod} onChange={(e) => setGeneratePeriod(e.target.value)} />
                        <button disabled={staffing.syncing} onClick={() => { if (confirm(`Generate monthly pool for ${generatePeriod}?`)) staffing.generateMonthlyDispatch(generatePeriod); }} className="btn-primary px-8">Generate Personnel Pool</button>
                        <button onClick={() => {
                            const periodAssignments = staffing.assignments.filter((a: Assignment) => a.period === generatePeriod);
                            if (periodAssignments.length === 0) { alert('No dispatch found for this period.'); return; }
                            const gridRows: any[] = [];
                            let maxDocs = 0; const wardToDocs: Record<string, string[]> = {};
                            staffing.wards.forEach(w => {
                                const assignment = periodAssignments.find(a => a.wardId === w.id);
                                const docNames = (assignment?.doctorIds || []).map(id => staffing.doctorMap.get(id)?.name || 'Unknown');
                                wardToDocs[w.name] = docNames; maxDocs = Math.max(maxDocs, docNames.length);
                            });
                            for (let i = 0; i < maxDocs; i++) {
                                const row: any = { 'Month': i === 0 ? generatePeriod : '' };
                                staffing.wards.forEach(w => { row[w.name] = wardToDocs[w.name][i] || ''; });
                                gridRows.push(row);
                            }
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gridRows), "Monthly Dispatch");
                            XLSX.writeFile(wb, `Dispatch_${generatePeriod}.xlsx`);
                        }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2"><Download className="w-4 h-4" /> Export Pool</button>
                    </div>
                </div>
            )}
        </div>
    );
});

const DoctorsView = React.memo(({ staffing, user, onNavigate }: { staffing: any, user: AuthUser, onNavigate: (id: string) => void }) => {
    const [activeTab, setActiveTab] = useState<'registry' | 'teams'>('registry');
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({ name: '', gender: 'Male', previousWards: [] });
    const [newTeam, setNewTeam] = useState<{ name: string, color: string }>({ name: '', color: 'violet' });
    const [dragDoc, setDragDoc] = useState<string | null>(null);

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

    const handleCreateTeam = () => {
        if (!newTeam.name) return;
        const team: Team = {
            id: `team-${Math.random().toString(36).substr(2, 5)}`,
            name: newTeam.name,
            color: newTeam.color,
            memberIds: []
        };
        staffing.updateTeams([...staffing.teams, team]);
        setNewTeam({ name: '', color: 'violet' });
    };

    const handleDeleteTeam = (id: string) => {
        if (confirm('Delete this team? Members will not be deleted.')) {
            staffing.updateTeams(staffing.teams.filter((t: Team) => t.id !== id));
        }
    };

    const handleAddToTeam = (teamId: string, doctorId: string) => {
        const team = staffing.teams.find((t: Team) => t.id === teamId);
        if (!team || team.memberIds.includes(doctorId)) return;
        
        // Remove from other teams first (optional, but usually desired for "atomic" teams)
        const updatedTeams = staffing.teams.map((t: Team) => ({
            ...t,
            memberIds: t.id === teamId 
                ? [...t.memberIds, doctorId] 
                : t.memberIds.filter(id => id !== doctorId)
        }));
        staffing.updateTeams(updatedTeams);
    };

    const handleRemoveFromTeam = (teamId: string, doctorId: string) => {
        const updatedTeams = staffing.teams.map((t: Team) => 
            t.id === teamId ? { ...t, memberIds: t.memberIds.filter(id => id !== doctorId) } : t
        );
        staffing.updateTeams(updatedTeams);
    };

    const colors = [
        { id: 'violet', bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
        { id: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
        { id: 'rose', bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
        { id: 'amber', bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
        { id: 'cyan', bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
        { id: 'orange', bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
                <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-bold text-slate-800">Personnel Management</h2>
                    <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                        <button 
                            onClick={() => setActiveTab('registry')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'registry' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Users className="w-3.5 h-3.5" /> Staff Registry
                        </button>
                        <button 
                            onClick={() => setActiveTab('teams')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'teams' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <UsersRound className="w-3.5 h-3.5" /> Clinical Teams
                        </button>
                    </div>
                </div>
                {user.role === 'admin' && activeTab === 'registry' && (
                    <button className="btn-primary" onClick={() => { setShowAdd(!showAdd); setEditingId(null); setNewDoctor({ name: '', gender: 'Male', previousWards: [] }); }}>
                        <UserPlus className="w-4 h-4" /> Register Personnel
                    </button>
                )}
            </div>

            {activeTab === 'registry' ? (
                <>
                    <AnimatePresence>
                        {showAdd && user.role === 'admin' && !editingId && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="technical-card p-8 bg-white mb-6 border-blue-100 ring-1 ring-blue-50">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div><label className="text-[10px] uppercase font-bold text-slate-400">Full Name</label><input type="text" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newDoctor.name} onChange={e => setNewDoctor(prev => ({ ...prev, name: e.target.value }))} /></div>
                                        <div><label className="text-[10px] uppercase font-bold text-slate-400">Gender</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newDoctor.gender} onChange={e => setNewDoctor(prev => ({ ...prev, gender: e.target.value as Gender }))}><option value="Male">Male</option><option value="Female">Female</option></select></div>
                                    </div>
                                    <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100"><button className="btn-primary px-8" onClick={handleAdd}>Save Physician</button></div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="technical-card overflow-hidden">
                        <table className="technical-grid">
                            <thead><tr className="bg-slate-50/50"><th className="col-header">ID</th><th className="col-header">Name</th><th className="col-header">Gender</th><th className="col-header">Team</th>{user.role === 'admin' && <th className="col-header text-right">Actions</th>}</tr></thead>
                            <tbody className="text-sm divide-y divide-slate-100">
                                {filtered.map((d: Doctor) => {
                                    const team = staffing.teams.find((t: Team) => t.memberIds.includes(d.id));
                                    const teamColor = team ? colors.find(c => c.id === team.color) : null;
                                    return (
                                        editingId === d.id ? (
                                            <tr key={d.id} className="bg-blue-50/30">
                                                <td colSpan={user.role === 'admin' ? 5 : 4} className="p-0">
                                                    <div className="p-6 border-y border-blue-100 shadow-inner">
                                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-4">Edit Personnel Record</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Full Name</label><input type="text" className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newDoctor.name} onChange={e => setNewDoctor(prev => ({ ...prev, name: e.target.value }))} /></div>
                                                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Gender</label><select className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newDoctor.gender} onChange={e => setNewDoctor(prev => ({ ...prev, gender: e.target.value as Gender }))}><option value="Male">Male</option><option value="Female">Female</option></select></div>
                                                        </div>
                                                        <div className="flex gap-3 mt-6 pt-4 border-t border-blue-100/50">
                                                            <button className="btn-primary px-6 py-2" onClick={handleAdd}>Save Changes</button>
                                                            <button className="px-6 py-2 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-widest" onClick={() => setEditingId(null)}>Cancel</button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr key={d.id} className="hover:bg-slate-50/50 group">
                                                <td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">{d.id}</td>
                                                <td className="px-6 py-4 font-semibold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-2" onClick={() => onNavigate(d.id)}>
                                                    {d.name}
                                                    {d.role === 'admin' && <Shield className="w-3 h-3 text-indigo-500" title="Administrator" />}
                                                </td>
                                                <td className="px-6 py-4 text-xs"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${d.gender === 'Male' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-pink-50 text-pink-600 border-pink-100'}`}>{d.gender}</span></td>
                                                <td className="px-6 py-4">
                                                    {team ? (
                                                        <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-black uppercase border ${teamColor?.bg} ${teamColor?.text} ${teamColor?.border}`}>
                                                            {team.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] text-slate-300 font-bold uppercase italic">Independent</span>
                                                    )}
                                                </td>
                                                {user.role === 'admin' && (
                                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                        <button 
                                                            className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${d.role === 'admin' ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`} 
                                                            onClick={() => {
                                                                if (d.id === user.id) { alert("You cannot change your own role."); return; }
                                                                const newRole = d.role === 'admin' ? 'resident' : 'admin';
                                                                if (confirm(`Change ${d.name}'s role to ${newRole.toUpperCase()}?`)) {
                                                                    staffing.updateDoctor({ ...d, role: newRole });
                                                                }
                                                            }}
                                                            title={d.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                                                        >
                                                            <Shield className="w-4 h-4" />
                                                        </button>
                                                        <button className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingId(d.id); setNewDoctor(d); setShowAdd(false); }}><Edit2 className="w-4 h-4" /></button>
                                                        <button className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { if (confirm('Delete?')) staffing.deleteDoctor(d.id); }}><Trash2 className="w-4 h-4" /></button>
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Team Creation & Management */}
                    <div className="lg:col-span-2 space-y-6">
                        {user.role === 'admin' && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-blue-600" /> Establish Clinical Team
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Team Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Senior Residents A"
                                            className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg mt-1" 
                                            value={newTeam.name} 
                                            onChange={e => setNewTeam(prev => ({ ...prev, name: e.target.value }))} 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Visual Identity</label>
                                        <div className="flex gap-2 mt-1">
                                            {colors.map(c => (
                                                <button 
                                                    key={c.id}
                                                    onClick={() => setNewTeam(prev => ({ ...prev, color: c.id }))}
                                                    className={`w-8 h-8 rounded-full border-2 transition-all ${c.bg} ${newTeam.color === c.id ? 'border-blue-600 scale-110 shadow-md' : 'border-white hover:scale-105'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    className="btn-primary w-full md:w-auto px-8" 
                                    onClick={handleCreateTeam}
                                    disabled={!newTeam.name}
                                >
                                    Create Team
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {staffing.teams.map((t: Team) => {
                                const tColor = colors.find(c => c.id === t.color);
                                return (
                                    <div 
                                        key={t.id} 
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={() => dragDoc && handleAddToTeam(t.id, dragDoc)}
                                        className={`bg-white rounded-2xl border-2 p-5 transition-all flex flex-col min-h-[180px] ${tColor?.border} hover:shadow-lg`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className={`text-sm font-bold ${tColor?.text}`}>{t.name}</h4>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                    {t.memberIds.length} Members Co-assigned
                                                </p>
                                            </div>
                                            {user.role === 'admin' && (
                                                <button 
                                                    onClick={() => handleDeleteTeam(t.id)}
                                                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            {t.memberIds.map(mId => {
                                                const doc = staffing.doctorMap.get(mId);
                                                return (
                                                    <div key={mId} className={`flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 group`}>
                                                        <span className="text-[11px] font-bold text-slate-700">{doc?.name || mId}</span>
                                                        {user.role === 'admin' && (
                                                            <button 
                                                                onClick={() => handleRemoveFromTeam(t.id, mId)}
                                                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {t.memberIds.length === 0 && (
                                                <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                                                    <p className="text-[10px] text-slate-300 font-bold uppercase italic">Drag clinicians here</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Available Doctors Pool for Drag-Drop */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
                            <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <UsersRound className="w-4 h-4 text-blue-600" /> Available Personnel Pool
                            </h3>
                            <p className="text-[10px] text-slate-400 mb-4 italic">Drag a clinician into a team card to link their schedules.</p>
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                                {filtered.map((d: Doctor) => {
                                    const inTeam = staffing.teams.some((t: Team) => t.memberIds.includes(d.id));
                                    if (inTeam) return null;
                                    return (
                                        <div 
                                            key={d.id} 
                                            draggable={user.role === 'admin'}
                                            onDragStart={() => setDragDoc(d.id)}
                                            onDragEnd={() => setDragDoc(null)}
                                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 cursor-grab active:cursor-grabbing hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-2 group"
                                        >
                                            <div className={`w-2 h-2 rounded-full ${d.gender === 'Male' ? 'bg-blue-400' : 'bg-pink-400'}`} />
                                            {d.name}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});


const WardsView = React.memo(({ staffing, user, onNavigate }: { staffing: any, user: AuthUser, onNavigate: (id: string) => void }) => {
    const isAdmin = user.role === 'admin';
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const [targetPeriod, setTargetPeriod] = useState(currentPeriod);
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newWard, setNewWard] = useState<Partial<Ward>>({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None', staffPerShift: 1, shiftDuration: '12h' } });
    const [dragDoctor, setDragDoctor] = useState<string | null>(null);

    const periodAssignments = staffing.assignments.filter((a: any) => a.period === targetPeriod);
    const assignedDoctorIds = new Set(periodAssignments.flatMap((a: any) => a.doctorIds));
    const unassignedDoctors = staffing.doctors.filter((d: Doctor) => d.id !== 'root' && !assignedDoctorIds.has(d.id));

    const handleAdd = () => {
        if (!newWard.name) return;
        const payload = {
            id: editingId || `ward-${Math.random().toString(36).substr(2, 5)}`,
            name: newWard.name.trim(),
            parentWardId: newWard.parentWardId,
            hiddenFromCalendar: newWard.hiddenFromCalendar || false,
            requirements: {
                totalDoctors: Number(newWard.requirements?.totalDoctors || 2),
                genderDiversity: newWard.requirements?.genderDiversity || 'None',
                requiredMale: Number(newWard.requirements?.requiredMale || 0),
                requiredFemale: Number(newWard.requirements?.requiredFemale || 0),
                staffPerShift: Number(newWard.requirements?.staffPerShift || 1) as 1 | 2,
                shiftDuration: newWard.requirements?.shiftDuration || '12h',
                shiftWeight: newWard.requirements?.shiftWeight
            }
        };
        if (editingId) staffing.updateWard(payload); else staffing.addWard(payload);
        setShowAdd(false); setEditingId(null); setNewWard({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None', staffPerShift: 1, shiftDuration: '12h' }, hiddenFromCalendar: false });
    };

    const handleDrop = (wardId: string) => {
        if (!dragDoctor || !isAdmin) return;
        staffing.manualAssignDoctor(dragDoctor, wardId, targetPeriod);
        setDragDoctor(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
                <div><h2 className="text-xl font-bold text-slate-800">Unit Configuration</h2><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Personnel Dispatch & Unit Management</p></div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <input type="month" className="text-sm p-2 bg-slate-50 border border-slate-200 rounded-xl" value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value)} />
                    {isAdmin && (<button className="btn-primary" onClick={() => { setShowAdd(!showAdd); setEditingId(null); setNewWard({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None', staffPerShift: 1, shiftDuration: '12h' } }); }}><Plus className="w-4 h-4" /> Add Unit</button>)}
                </div>
            </div>

            {isAdmin && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Unassigned Personnel Pool ({targetPeriod})</h3>
                    <div className="flex flex-wrap gap-2">
                        {unassignedDoctors.length > 0 ? unassignedDoctors.map((d: Doctor) => (
                            <div key={d.id} draggable onDragStart={() => setDragDoctor(d.id)} onClick={() => onNavigate(d.id)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 cursor-grab active:cursor-grabbing hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${d.gender === 'Male' ? 'bg-blue-400' : 'bg-pink-400'}`} />
                                {d.name}
                            </div>
                        )) : (
                            <p className="text-xs text-slate-400 italic">All clinicians have been dispatched for this rotation.</p>
                        )}
                    </div>
                    <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-tighter italic">* Drag a physician from the pool and drop them on a unit below to manually assign them.</p>
                </div>
            )}

            <AnimatePresence>{showAdd && isAdmin && !editingId && (
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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-100">
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Hierarchy</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.parentWardId || ''} onChange={e => setNewWard(prev => ({ ...prev, parentWardId: e.target.value || undefined }))}><option value="">Main Unit (Stand-alone)</option>{staffing.wards.filter((w: Ward) => w.id !== editingId).map((w: Ward) => (<option key={w.id} value={w.id}>Subordinate to {w.name}</option>))}</select></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Shift Coverage</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.staffPerShift} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, staffPerShift: parseInt(e.target.value) as 1 | 2 } }))}><option value={1}>1 Physician Per Shift</option><option value={2}>2 Physicians Per Shift</option></select></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Shift Duration</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.shiftDuration} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, shiftDuration: e.target.value as any } }))}><option value="6h">6 Hours</option><option value="12h">12 Hours</option><option value="24h">24 Hours</option></select></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-400">Custom Weight (Hrs)</label><input type="number" min="0" placeholder="Optional" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.shiftWeight || ''} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, shiftWeight: e.target.value ? parseInt(e.target.value) : undefined } }))} /></div>
                            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-auto h-[42px] md:col-span-4">
                                <input type="checkbox" id="hideWardAdd" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={newWard.hiddenFromCalendar || false} onChange={e => setNewWard(prev => ({ ...prev, hiddenFromCalendar: e.target.checked }))} />
                                <label htmlFor="hideWardAdd" className="text-[10px] uppercase font-bold text-slate-600 cursor-pointer">Hide from Calendar</label>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-6 border-t border-slate-100"><button className="btn-primary px-8" onClick={handleAdd}>Save Unit</button></div>
                    </div>
                </motion.div>
            )}</AnimatePresence>

            <div className="technical-card overflow-hidden">
                <table className="technical-grid">
                    <thead><tr className="bg-slate-50/50"><th className="col-header">ID</th><th className="col-header">Name</th><th className="col-header">Shift Specs</th><th className="col-header">Status</th><th className="col-header">Personnel Pool</th>{isAdmin && <th className="col-header text-right">Actions</th>}</tr></thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                        {staffing.wards.map((w: Ward) => {
                            const assignment = periodAssignments.find((a: any) => a.wardId === w.id);
                            const docCount = assignment?.doctorIds.length || 0;
                            return editingId === w.id ? (
                                <tr key={w.id} className="bg-blue-50/30">
                                    <td colSpan={isAdmin ? 6 : 5} className="p-0">
                                        <div className="p-8 border-y border-blue-100 shadow-inner space-y-6">
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Edit Unit Configuration</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                <div className="md:col-span-2"><label className="text-[10px] uppercase font-bold text-slate-400">Designation</label><input type="text" className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.name} onChange={e => setNewWard(prev => ({ ...prev, name: e.target.value }))} /></div>
                                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Monthly Capacity</label><input type="number" className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.requirements?.totalDoctors} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, totalDoctors: parseInt(e.target.value) } }))} /></div>
                                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Gender Policy</label><select className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.requirements?.genderDiversity} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, genderDiversity: e.target.value as any } }))}><option value="None">No Preference</option><option value="Balanced">Balanced Mix</option><option value="Specific">Specific Quota</option></select></div>
                                            </div>
                                            {newWard.requirements?.genderDiversity === 'Specific' && (
                                                <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                                                    <div><label className="text-[10px] uppercase font-bold text-slate-400">Required Male</label><input type="number" className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.requirements?.requiredMale} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, requiredMale: parseInt(e.target.value) } }))} /></div>
                                                    <div><label className="text-[10px] uppercase font-bold text-slate-400">Required Female</label><input type="number" className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.requirements?.requiredFemale} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, requiredFemale: parseInt(e.target.value) } }))} /></div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-blue-100/50">
                                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Hierarchy</label><select className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.parentWardId || ''} onChange={e => setNewWard(prev => ({ ...prev, parentWardId: e.target.value || undefined }))}><option value="">Main Unit (Stand-alone)</option>{staffing.wards.filter((sw: Ward) => sw.id !== editingId).map((sw: Ward) => (<option key={sw.id} value={sw.id}>Subordinate to {sw.name}</option>))}</select></div>
                                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Shift Coverage</label><select className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.requirements?.staffPerShift} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, staffPerShift: parseInt(e.target.value) as 1 | 2 } }))}><option value={1}>1 Physician Per Shift</option><option value={2}>2 Physicians Per Shift</option></select></div>
                                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Shift Duration</label><select className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.requirements?.shiftDuration} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, shiftDuration: e.target.value as any } }))}><option value="6h">6 Hours</option><option value="12h">12 Hours</option><option value="24h">24 Hours</option></select></div>
                                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Custom Weight (Hrs)</label><input type="number" min="0" placeholder="Optional" className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg shadow-sm" value={newWard.requirements?.shiftWeight || ''} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, shiftWeight: e.target.value ? parseInt(e.target.value) : undefined } }))} /></div>
                                                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm mt-auto h-[42px] md:col-span-4">
                                                    <input type="checkbox" id={`hideWard-${w.id}`} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={newWard.hiddenFromCalendar || false} onChange={e => setNewWard(prev => ({ ...prev, hiddenFromCalendar: e.target.checked }))} />
                                                    <label htmlFor={`hideWard-${w.id}`} className="text-[10px] uppercase font-bold text-slate-600 cursor-pointer">Hide from Calendar</label>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 pt-6 border-t border-blue-100/50">
                                                <button className="btn-primary px-8" onClick={handleAdd}>Save Changes</button>
                                                <button className="px-6 py-2 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-widest" onClick={() => setEditingId(null)}>Cancel</button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={w.id} onDragOver={e => isAdmin && e.preventDefault()} onDrop={() => handleDrop(w.id)} className={`hover:bg-slate-50/50 group transition-all ${dragDoctor ? 'bg-blue-50/50 ring-1 ring-blue-100 ring-inset' : ''}`}>
                                    <td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">{w.id}</td>
                                    <td className="px-6 py-4 font-semibold text-slate-800">{w.name}</td>
                                    <td className="px-6 py-4"><div className="flex gap-2"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase rounded border border-blue-100 flex items-center gap-1"><Activity className="w-3 h-3" /> {w.requirements.staffPerShift} Doc</span><span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded border border-slate-200 flex items-center gap-1"><Clock className="w-3 h-3" /> {w.requirements.shiftDuration}</span></div></td>
                                    <td className="px-6 py-4">
                                        {w.parentWardId ? (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-bold uppercase rounded border border-slate-200 flex items-center gap-1"><Link className="w-3 h-3" /> Sub to {staffing.wardMap.get(w.parentWardId)?.name}</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] font-bold uppercase rounded border border-green-100">Main Station</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-2">
                                                {assignment?.doctorIds.slice(0, 3).map((id: string) => (
                                                    <div key={id} onClick={() => onNavigate(id)} className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-all">{staffing.doctorMap.get(id)?.name.charAt(0)}</div>
                                                ))}
                                                {docCount > 3 && <div className="w-7 h-7 rounded-full border-2 border-white bg-blue-600 flex items-center justify-center text-[8px] font-bold text-white">+{docCount - 3}</div>}
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase tracking-tighter ${docCount >= w.requirements.totalDoctors ? 'text-green-600' : 'text-amber-500'}`}>{docCount} / {w.requirements.totalDoctors} Staffed</span>
                                        </div>
                                    </td>
                                    {isAdmin && <td className="px-6 py-4 text-right flex justify-end gap-2"><button className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingId(w.id); setNewWard(w); setShowAdd(false); }}><Edit2 className="w-4 h-4" /></button><button className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { if (confirm('Remove?')) staffing.deleteWard(w.id); }}><Trash2 className="w-4 h-4" /></button></td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

const MonthlyArchiveView = React.memo(({ staffing, user, selectedPeriod, onSelect, onNavigate }: { staffing: any, user: AuthUser, selectedPeriod: string | null, onSelect: (m: string | null) => void, onNavigate: (id: string) => void }) => {
    const isAdmin = user.role === 'admin';
    const periods = useMemo(() => [...new Set(staffing.assignments.map((a: Assignment) => a.period))].sort((a, b) => (b as string).localeCompare(a as string)), [staffing.assignments]);
    const [viewMode, setViewMode] = useState<'dispatch' | 'ward' | 'er'>('dispatch');

    const handleExportExcel = (type: 'ward' | 'er') => {
        if (!selectedPeriod) return;
        const shifts = staffing.shifts.filter((s: ShiftRecord) => s.period === selectedPeriod && (type === 'er' ? s.wardId.startsWith('er-') : !s.wardId.startsWith('er-')));
        if (shifts.length === 0) { alert('No data to export.'); return; }
        const grid: any[] = [];
        shifts.sort((a: any, b: any) => a.day - b.day).forEach((s: any) => {
            grid.push({
                Day: s.day,
                Unit: s.wardId.startsWith('er-') ? (s.wardId === 'referral' ? 'REFERRAL' : s.wardId.replace('er-', '').toUpperCase()) : (staffing.wardMap.get(s.wardId)?.name || s.wardId),
                Personnel: staffing.doctorMap.get(s.doctorId)?.name || 'Unknown',
                Role: s.wardId.startsWith('er-') ? 'ER Call' : 'Ward Duty'
            });
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grid), `${type.toUpperCase()} Log`);
        XLSX.writeFile(wb, `${type.toUpperCase()}_Log_${selectedPeriod}.xlsx`);
    };

    if (!selectedPeriod) {
        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-800">Operational Archives</h2>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Select a rotation cycle to view logs</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {periods.length > 0 ? periods.map(p => {
                        const pShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === p);
                        const uniqueDocs = new Set(pShifts.map((s: ShiftRecord) => s.doctorId)).size;
                        return (
                            <div key={p} onClick={() => onSelect(p)} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all"><Archive className="w-6 h-6" /></div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(p + '-02'))}</h3>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1 mb-4">Rotation {p}</p>
                                <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Activity className="w-3.5 h-3.5" /> {pShifts.length} Shifts</div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Users className="w-3.5 h-3.5" /> {uniqueDocs} Staff</div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
                            <Archive className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 text-sm italic">No archived rotations found yet.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const periodAssignments = staffing.assignments.filter((a: Assignment) => a.period === selectedPeriod);
    const periodShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === selectedPeriod);
    const wardShifts = periodShifts.filter(s => !s.wardId.startsWith('er-'));
    const erShifts = periodShifts.filter(s => s.wardId.startsWith('er-'));

    const [year, month] = selectedPeriod.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const [dragState, setDragState] = useState<{ doctorId: string, wardId: string } | null>(null);

    return (
        <div className="space-y-6 pb-24">
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => onSelect(null)} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200"><ChevronLeft className="w-5 h-5" /></button>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-800">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(selectedPeriod + '-02'))}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] md:text-[9px] text-slate-400 uppercase font-bold tracking-widest">Archived Rotation</span>
                            <div className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="text-[8px] md:text-[9px] text-blue-600 uppercase font-bold tracking-widest">{selectedPeriod}</span>
                        </div>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {(['dispatch', 'ward', 'er'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-4 py-2 text-[9px] md:text-[10px] font-bold uppercase rounded-lg transition-all ${viewMode === mode ? 'bg-white text-blue-600 shadow-md shadow-blue-600/5' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {mode} Log
                        </button>
                    ))}
                </div>

                {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleExportExcel(viewMode === 'er' ? 'er' : 'ward')} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"><Download className="w-3.5 h-3.5" /> Export {viewMode.toUpperCase()}</button>

                        <div className="h-8 w-px bg-slate-200 mx-1" />

                        <button
                            onClick={() => { if (confirm('Add this month\'s assignments to each clinician\'s permanent clinical history?')) staffing.batchUpdateHistory(selectedPeriod, 'add'); }}
                            className="flex items-center gap-2 text-[10px] font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-100 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all"
                            title="Commit rotation to history"
                        >
                            <History className="w-3.5 h-3.5" /> Commit to History
                        </button>
                        <button
                            onClick={() => { if (confirm('Remove this month\'s assignments from each clinician\'s clinical history?')) staffing.batchUpdateHistory(selectedPeriod, 'remove'); }}
                            className="flex items-center gap-2 text-[10px] font-bold uppercase bg-slate-50 text-slate-500 border border-slate-100 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all"
                            title="Revert history changes"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Revert History
                        </button>

                        <div className="h-8 w-px bg-slate-200 mx-1" />

                        {viewMode !== 'dispatch' && (
                            <button
                                onClick={() => staffing.clearRosterByPeriod(selectedPeriod, viewMode)}
                                className="flex items-center gap-2 text-[10px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-100 px-4 py-2 rounded-xl hover:bg-amber-100 transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Purge {viewMode.toUpperCase()}
                            </button>
                        )}
                        <button
                            onClick={() => { if (confirm(`EXTREME DANGER: Permanently delete ALL records (Personnel Pool AND Rosters) for ${selectedPeriod}?`)) { staffing.deleteDispatchByPeriod(selectedPeriod); onSelect(null); } }}
                            className="flex items-center gap-2 text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl hover:bg-red-100 transition-all"
                        >
                            <Lock className="w-3.5 h-3.5" /> Delete Full Month
                        </button>
                    </div>
                )}
            </div>

            {viewMode === 'dispatch' ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
                    <div className="p-6">
                        <table className="technical-grid w-full">
                            <thead><tr className="bg-slate-50/50"><th className="col-header">Ward Unit</th><th className="col-header">Personnel Pool</th></tr></thead>
                            <tbody className="text-sm divide-y divide-slate-100">
                                {periodAssignments.map((a: Assignment) => (
                                    <tr
                                        key={a.id}
                                        onDragOver={(e) => { if (isAdmin && dragState && dragState.wardId !== a.wardId) e.preventDefault(); }}
                                        onDrop={(e) => {
                                            // Only fire if the drop landed on the row itself (empty space),
                                            // not on a child doctor badge (those stop propagation).
                                            if (!dragState || !isAdmin || dragState.wardId === a.wardId) return;
                                            staffing.movePoolDoctor(selectedPeriod, dragState.wardId, dragState.doctorId, a.wardId);
                                            setDragState(null);
                                        }}
                                        className={`transition-colors ${isAdmin && dragState && dragState.wardId !== a.wardId ? 'ring-2 ring-inset ring-blue-400/40 bg-blue-50/30' : ''}`}
                                    >
                                        <td className="px-6 py-4 font-bold text-slate-700">{staffing.wardMap.get(a.wardId)?.name}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {a.doctorIds.map(id => (
                                                    <span
                                                        key={id}
                                                        onClick={() => onNavigate(id)}
                                                        draggable={isAdmin}
                                                        onDragStart={() => setDragState({ doctorId: id, wardId: a.wardId })}
                                                        onDragOver={(e) => { if (isAdmin) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onDrop={(e) => {
                                                            e.stopPropagation(); // prevent row-level drop from also firing
                                                            if (!dragState || !isAdmin || dragState.doctorId === id) return;
                                                            staffing.swapPoolDoctors(selectedPeriod, dragState.wardId, dragState.doctorId, a.wardId, id);
                                                            setDragState(null);
                                                        }}
                                                        className={`px-3 py-1 border rounded-lg text-[10px] font-bold uppercase cursor-pointer transition-all ${dragState?.doctorId === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600'}`}
                                                    >
                                                        {staffing.doctorMap.get(id)?.name}
                                                    </span>
                                                ))}
                                                {/* Visual hint when dragging over this ward's empty area */}
                                                {isAdmin && dragState && dragState.wardId !== a.wardId && (
                                                    <span className="px-3 py-1 border-2 border-dashed border-blue-300 rounded-lg text-[10px] font-bold uppercase text-blue-400 animate-pulse pointer-events-none">
                                                        + Move here
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {periodAssignments.length === 0 && <tr><td colSpan={2} className="p-20 text-center text-slate-400 italic">No dispatch records found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : viewMode === 'ward' ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px] p-4 md:p-8">
                    <ShiftCalendarView key={`ward-${selectedPeriod}`} staffing={staffing} onNavigate={onNavigate} archivePeriod={selectedPeriod || undefined} />
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px] p-4 md:p-8">
                    <ERCallsView key={`er-${selectedPeriod}`} staffing={staffing} user={user} onNavigate={onNavigate} archivePeriod={selectedPeriod || undefined} />
                </div>
            )}
        </div>
    );
});

const AssignmentsView = React.memo(({ staffing }: { staffing: any }) => {
    return (<div className="space-y-6"><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h2 className="text-xl font-bold text-slate-800">Dispatch History</h2></div><div className="technical-card overflow-hidden"><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Period</th><th className="col-header">Ward</th><th className="col-header">Personnel Pool</th></tr></thead><tbody className="text-sm divide-y divide-slate-100">{staffing.assignments.slice().reverse().map((a: Assignment) => (<tr key={a.id}><td className="px-6 py-4 text-[10px] font-mono text-blue-600 font-bold uppercase">{a.period}</td><td className="px-6 py-4 font-semibold text-slate-800">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1.5 font-mono text-[9px]">{a.doctorIds.map(id => (<span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">{staffing.doctorMap.get(id)?.name}</span>))}</div></td></tr>))}</tbody></table></div></div>);
});

const HistoryLogView = React.memo(({ staffing }: { staffing: any }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-slate-900 p-3 rounded-2xl text-white"><History className="w-6 h-6" /></div>
                    <div><h2 className="text-2xl font-bold text-slate-900">Clinical Audit Trail</h2><p className="text-xs text-slate-400 uppercase font-bold tracking-widest mt-1">Personnel Adjustment Logs</p></div>
                </div>
                <div className="space-y-3">
                    {staffing.logs.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 italic text-sm">No activity recorded in the audit trail.</div>
                    ) : staffing.logs.map((log: AuditLog) => (
                        <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 text-slate-400 group-hover:text-blue-600 transition-all shadow-sm">
                                    {log.action === 'swap_er' ? <RefreshCw className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{log.details}</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Period: {log.period} أ¢â‚¬آ¢ {new Date(log.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-500 rounded-lg">{log.action}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) { return (<div className="bg-white border border-slate-200 rounded-xl p-6 flex items-start justify-between shadow-sm hover:shadow-md transition-shadow"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p><p className="text-3xl font-bold text-slate-900">{value}</p></div><div className="bg-blue-50 p-2.5 rounded-lg">{icon}</div></div>); }

const EquityView = React.memo(({ staffing, onNavigate }: { staffing: any, onNavigate: (id: string) => void }) => {
    const isAdmin = true; // For now, since it's the admin view anyway
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [targetPeriod, setTargetPeriod] = useState(currentMonth);
    const [excludedWardIds, setExcludedWardIds] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('wardstaffer_excluded_wards');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to parse excluded wards:', e);
            return [];
        }
    });
    const [showExclusionDrop, setShowExclusionDrop] = useState(false);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        localStorage.setItem('wardstaffer_excluded_wards', JSON.stringify(excludedWardIds));
    }, [excludedWardIds]);

    const sortedDoctors = useMemo(() => {
        const periodAssignments = staffing.assignments.filter((a: any) => a.period === targetPeriod);
        const periodShifts = staffing.shifts.filter((s: any) => s.period === targetPeriod);

        return staffing.doctors
            .filter((d: Doctor) => d.id !== 'root')
            .map((d: Doctor) => {
                const assignment = periodAssignments.find((a: any) => a.doctorIds.includes(d.id));
                const isExcluded = assignment && excludedWardIds.includes(assignment.wardId);

                // Calculate breakdown using configured durations
                const cfg = staffing.erConfig;
                const dur = cfg?.durations || { referral: 24, men: 6, women: 6, pediatric: 8 };
                const isERShift = (s: any) => s.wardId.startsWith('er-') || s.wardId === 'referral';
                const doctorShifts = periodShifts.filter((s: any) => s.doctorId === d.id);

                const wardHours = doctorShifts
                    .filter((s: any) => !isERShift(s))
                    .reduce((total: number, s: any) => {
                        const ward = staffing.wardMap.get(s.wardId);
                        if (ward?.requirements?.shiftWeight !== undefined) return total + ward.requirements.shiftWeight;
                        const duration = ward?.requirements?.shiftDuration;
                        return total + (duration === '6h' ? 6 : duration === '12h' ? 12 : 24);
                    }, 0);

                const erHours = doctorShifts
                    .filter((s: any) => isERShift(s) && s.wardId !== 'referral')
                    .reduce((total: number, s: any) => {
                        if (s.wardId === 'er-men') return total + (dur.men ?? 6);
                        if (s.wardId === 'er-women') return total + (dur.women ?? 6);
                        if (s.wardId === 'er-pediatric') return total + (dur.pediatric ?? 8);
                        return total + 12;
                    }, 0);

                const refHours = doctorShifts
                    .filter((s: any) => s.wardId === 'referral')
                    .reduce((total: number, _s: any) => total + (dur.referral ?? 24), 0);

                return {
                    ...d,
                    currentWard: assignment ? staffing.wardMap.get(assignment.wardId)?.name : 'Float/Unassigned',
                    isExcluded,
                    wardHours,
                    erHours,
                    refHours,
                    totalHours: wardHours + erHours + refHours
                };
            })
            .sort((a: any, b: any) => {
                if (a.isExcluded !== b.isExcluded) return a.isExcluded ? 1 : -1;
                return b.totalHours - a.totalHours;
            });
    }, [staffing.doctors, targetPeriod, staffing.shifts, excludedWardIds, staffing.assignments, staffing.wardMap]);

    const integrityAudit = useMemo(() => {
        const periodAssignments = staffing.assignments.filter((a: any) => a.period === targetPeriod);
        const periodShifts = staffing.shifts.filter((s: any) => s.period === targetPeriod);

        // 1. Gyne Rule (Female Only)
        const gyneWards = staffing.wards.filter((w: Ward) => w.name.toLowerCase().includes('gyne'));
        const gyneViolations: string[] = [];
        gyneWards.forEach((w: Ward) => {
            const assignment = periodAssignments.find((a: Assignment) => a.wardId === w.id);
            if (assignment) {
                assignment.doctorIds.forEach(dId => {
                    const doc = staffing.doctorMap.get(dId);
                    if (doc && doc.gender !== 'Female') gyneViolations.push(`${doc.name} (${w.name})`);
                });
            }
        });

        // 2. Pediatrics Balance
        const pedsWards = staffing.wards.filter((w: Ward) => w.name.toLowerCase().includes('pediatric'));
        const pedsViolations: string[] = [];
        pedsWards.forEach((w: Ward) => {
            const assignment = periodAssignments.find((a: Assignment) => a.wardId === w.id);
            if (assignment && assignment.doctorIds.length > 0) {
                const docs = assignment.doctorIds.map(id => staffing.doctorMap.get(id)).filter(Boolean);
                const females = docs.filter(d => d.gender === 'Female').length;
                const ratio = females / docs.length;
                if (ratio < 0.35 || ratio > 0.65) pedsViolations.push(`${w.name} (${Math.round(ratio * 100)}% F)`);
            }
        });

        // 3. Conflicts
        const fatigueRisks: { shiftId: string; msg: string }[] = [];
        const SLOT_START = [8, 14, 20, 26];
        const SLOT_END = [14, 20, 26, 32];

        staffing.doctors.forEach((doc: Doctor) => {
            if (doc.id === 'root') return;
            const docShifts = periodShifts.filter((s: ShiftRecord) => s.doctorId === doc.id).sort((a: any, b: any) => a.day - b.day || (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

            for (let i = 0; i < docShifts.length; i++) {
                const s1 = docShifts[i];
                if (i < docShifts.length - 1) {
                    const s2 = docShifts[i + 1];

                    let start1 = (s1.day - 1) * 24 + (SLOT_START[s1.slotIndex ?? 0] ?? 8);
                    let end1 = (s1.day - 1) * 24 + (SLOT_END[s1.slotIndex ?? 0] ?? 24);
                    if (!s1.wardId.startsWith('er-') && s1.slotIndex === undefined) {
                        const ward = staffing.wardMap.get(s1.wardId);
                        const duration = ward?.requirements?.shiftDuration === '6h' ? 6 : ward?.requirements?.shiftDuration === '12h' ? 12 : 24;
                        end1 = start1 + duration;
                    }

                    let start2 = (s2.day - 1) * 24 + (SLOT_START[s2.slotIndex ?? 0] ?? 8);

                    const gap = start2 - end1;
                    if (gap < 12) {
                        fatigueRisks.push({
                            shiftId: s1.id,
                            msg: `${doc.name}: ${gap < 0 ? 'Overlap' : 'Fatigue (' + gap + 'h gap)'} Day ${s1.day}`
                        });
                    }
                }
            }
        });

        // 4. Unassigned
        const assignedIds = new Set(periodAssignments.flatMap((a: Assignment) => a.doctorIds));
        const unassignedCount = staffing.doctors.filter((d: Doctor) => d.id !== 'root' && !assignedIds.has(d.id)).length;

        return [
            { id: 'gyne', label: 'Gynecology Female-Only Compliance', status: gyneViolations.length === 0 ? 'pass' : 'fail', detail: gyneViolations.length > 0 ? `Violations: ${gyneViolations.join(', ')}` : 'All Gynecology units are female-only compliant.' },
            { id: 'peds', label: 'Pediatric Gender Equilibrium', status: pedsViolations.length === 0 ? 'pass' : 'warn', detail: pedsViolations.length > 0 ? `Skewed: ${pedsViolations.join(', ')}` : 'Pediatric units maintain gender diversity.' },
            { id: 'conflicts', label: 'Shift Overlap & Fatigue Audit', status: fatigueRisks.length === 0 ? 'pass' : 'fail', detail: fatigueRisks.length > 0 ? `Detected: ${fatigueRisks.map(r => r.msg).slice(0, 2).join('; ')}` : 'No conflicting or fatigue-risk shifts detected.', actionId: fatigueRisks[0]?.shiftId },
            { id: 'assigned', label: 'Personnel Dispatch Coverage', status: unassignedCount === 0 ? 'pass' : 'warn', detail: unassignedCount > 0 ? `${unassignedCount} physicians remain unassigned.` : 'Full clinical staff deployment achieved.' }
        ];
    }, [staffing.doctors, staffing.wards, staffing.assignments, staffing.shifts, staffing.doctorMap, targetPeriod]);

    const activeStats = sortedDoctors.filter(d => !d.isExcluded);
    const maxDoc = activeStats[0];
    const minDoc = activeStats[activeStats.length - 1];
    const variance = maxDoc && minDoc ? maxDoc.totalHours - minDoc.totalHours : 0;

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Equity Engine</h2>
                    <p className="text-sm text-slate-500">Manage clinical workload distribution and departmental exemptions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="month"
                        value={targetPeriod}
                        onChange={(e) => setTargetPeriod(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="relative">
                        <button
                            onClick={() => setShowExclusionDrop(!showExclusionDrop)}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <Filter className="w-4 h-4" /> Units Exempted ({excludedWardIds.length})
                        </button>
                        {showExclusionDrop && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-[100] p-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Toggle Exemption</h4>
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {staffing.wards.filter((w: Ward) => !w.parentWardId).map((w: Ward) => (
                                        <label key={w.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={excludedWardIds.includes(w.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setExcludedWardIds([...excludedWardIds, w.id]);
                                                    else setExcludedWardIds(excludedWardIds.filter(id => id !== w.id));
                                                }}
                                                className="w-4 h-4 rounded text-blue-600"
                                            />
                                            <span className="text-xs font-bold text-slate-700">{w.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-10">
                <button onClick={() => setShowLogs(false)} className={`px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${!showLogs ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Equity Dashboard</button>
                <button onClick={() => setShowLogs(true)} className={`px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${showLogs ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>History Log</button>
            </div>

            {showLogs ? (
                <HistoryLogView staffing={staffing} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Clinical Workload Registry</h3>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{activeStats.length} Included / {excludedWardIds.length} Exempt</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white border-b border-slate-100">
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Physician</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Primary Unit</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workload (Ward/ER/Ref)</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {sortedDoctors.map((d: any) => (
                                            <tr key={d.id} className={`group hover:bg-slate-50 transition-colors ${d.isExcluded ? 'opacity-40 grayscale' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all cursor-pointer" onClick={() => onNavigate(d.id)}>{d.name.charAt(0)}</div>
                                                        <span className="text-sm font-bold text-slate-700 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => onNavigate(d.id)}>{d.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{d.currentWard}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className={`h-full bg-blue-500`} style={{ width: `${Math.min((d.wardHours / 160) * 100, 100)}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400">{d.wardHours}h</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className={`h-full bg-indigo-500`} style={{ width: `${Math.min((d.erHours / 80) * 100, 100)}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400">{d.erHours}h</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className={`h-full bg-amber-500`} style={{ width: `${Math.min((d.refHours / 48) * 100, 100)}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400">{d.refHours}h</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-sm font-black text-slate-900">{d.totalHours}h</span>
                                                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Total Weighted</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {d.isExcluded ? (
                                                        <span className="text-[8px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded uppercase tracking-widest">Exempt</span>
                                                    ) : (
                                                        <span className={`text-[8px] font-bold px-2 py-1 rounded uppercase tracking-widest ${d.totalHours > 180 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                                            {d.totalHours > 180 ? 'Peak' : 'Active'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden group">
                            <Activity className="absolute right-[-20px] top-[-20px] w-48 h-48 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                            <div className="relative z-10">
                                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-6">Equity Control</h3>
                                <div className="space-y-8">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-2">Workload Variance</p>
                                        <div className="flex items-end gap-3">
                                            <span className={`text-5xl font-black ${variance > 12 ? 'text-amber-400' : 'text-green-400'}`}>{variance}h</span>
                                            <span className="text-xs text-slate-400 mb-2 font-medium">Weighted Gap</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                            <p className="text-xs text-slate-300 leading-relaxed italic">
                                                {variance > 12
                                                    ? "Significant disparity detected. Auto-balance is recommended to redistribute ER shifts from peak clinicians to those with lower volume."
                                                    : "Workload distribution is currently within equitable thresholds. No intervention required."}
                                            </p>
                                        </div>

                                        {variance > 12 ? (
                                            <button
                                                onClick={() => { if (confirm(`Variance is ${variance}h. Execute auto-balance for ${targetPeriod}?`)) staffing.autoBalanceWorkload(targetPeriod, excludedWardIds); }}
                                                className="w-full bg-blue-600 text-white py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 active:scale-95"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${staffing.syncing ? 'animate-spin' : ''}`} />
                                                Execute Auto-Balance
                                            </button>
                                        ) : (
                                            <div className="w-full bg-green-500/20 text-green-400 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest border border-green-500/30 flex items-center justify-center gap-3">
                                                <CircleCheck className="w-4 h-4" />
                                                System Balanced
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-white/10 space-y-3">
                                            <button
                                                onClick={() => { if (confirm(`Optimize Referral rotations for male physicians in ${targetPeriod}?`)) staffing.optimizeReferralsForMales(targetPeriod); }}
                                                className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all border border-white/5 flex items-center justify-center gap-2"
                                            >
                                                <Users className="w-3.5 h-3.5" />
                                                Rearrange Male Referrals
                                            </button>
                                            <button
                                                onClick={() => { if (confirm(`Enforce 12h equity gap by redistributing ER calls for ${targetPeriod}?`)) staffing.autoBalanceWorkload(targetPeriod, excludedWardIds); }}
                                                className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all border border-white/5 flex items-center justify-center gap-2"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                12h Equity Redistribution
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><ListChecks className="w-4 h-4 text-blue-600" /> Clinical Integrity Checklist</h3>
                            <div className="space-y-4">
                                {integrityAudit.map(check => (
                                    <div key={check.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-black uppercase text-slate-700">{check.label}</span>
                                            {check.status === 'pass' ? <CircleCheck className="w-4 h-4 text-green-500" /> :
                                                check.status === 'warn' ? <TriangleAlert className="w-4 h-4 text-amber-500" /> :
                                                    <CircleX className="w-4 h-4 text-red-500" />}
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-relaxed italic">{check.detail}</p>
                                        {check.actionId && (
                                            <button
                                                onClick={() => staffing.resolveFatigueConflict(targetPeriod, check.actionId)}
                                                className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                            >
                                                <Zap className="w-3 h-3" /> Smart Resolve Conflict
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Scale className="w-4 h-4 text-blue-600" /> Metric Configuration</h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Referral Multiplier</p>
                                        <p className="text-[10px] text-slate-400 uppercase">Weight: 24.0x</p>
                                    </div>
                                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center"><Check className="w-5 h-5 text-green-500" /></div>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">ER Shift Weight</p>
                                        <p className="text-[10px] text-slate-400 uppercase">Weight: 12.0x</p>
                                    </div>
                                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center"><Check className="w-5 h-5 text-green-500" /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

const ShiftExchangeView = React.memo(({ staffing, user }: { staffing: any, user: any }) => {
    const isAdmin = user?.role === 'admin';
    const myId = user?.id;
    const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [period, setPeriod] = useState(currentPeriod);
    const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'request' | 'outgoing' | 'incoming' | 'admin'>('outgoing');

    const [myShiftId, setMyShiftId] = useState('');
    const [targetDoctorId, setTargetDoctorId] = useState('');
    const [targetShiftId, setTargetShiftId] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [adminNote, setAdminNote] = useState<Record<string, string>>({});
    const [working, setWorking] = useState<string | null>(null);

    const allPeriodShifts = staffing.shifts.filter((s: ShiftRecord) => s.period === period);
    const myShifts = allPeriodShifts.filter((s: ShiftRecord) => s.doctorId === myId);
    const targetShifts = allPeriodShifts.filter((s: ShiftRecord) => s.doctorId === targetDoctorId);

    const fetch_ = async () => {
        setLoading(true);
        try { const r = await fetch('/api/exchanges'); setExchanges(await r.json()); }
        catch { setExchanges([]); } finally { setLoading(false); }
    };
    useEffect(() => { fetch_(); }, [period]);

    const periodEx = exchanges.filter(e => e.period === period);
    const outgoing  = periodEx.filter(e => e.requesterId === myId);
    const incoming  = periodEx.filter(e => e.targetDoctorId === myId && e.status === 'pending_target');
    const adminQueue = periodEx.filter(e => e.status === 'target_accepted');
    const incomingCount = incoming.length;
    const adminCount = adminQueue.length;

    const getShiftLabel = (s: ShiftRecord) => {
        const w = s.wardId === 'referral' ? 'Referral Call'
            : s.wardId.startsWith('er-') ? `ER ${s.wardId.replace('er-','').toUpperCase()}`
            : staffing.wardMap.get(s.wardId)?.name || s.wardId;
        return `Day ${s.day} â€” ${w} ${getSlotName(s.slotIndex ?? 0, s.wardId)}`;
    };

    const analyzeConflict = (ex: ShiftExchange) => {
        const reqS = staffing.shifts.find((s: ShiftRecord) => s.id === ex.requesterShiftId);
        const tgtS = staffing.shifts.find((s: ShiftRecord) => s.id === ex.targetShiftId);
        if (!reqS || !tgtS) return { conflicts: ['One or both shifts no longer exist.'], safe: false };
        const conflicts: string[] = [];
        const reqDoc = staffing.doctorMap.get(ex.requesterId);
        const tgtDoc = staffing.doctorMap.get(ex.targetDoctorId);
        if (allPeriodShifts.some((s: ShiftRecord) => s.doctorId === ex.requesterId && s.id !== ex.requesterShiftId && s.day === tgtS.day))
            conflicts.push(`${reqDoc?.name} already has a shift on Day ${tgtS.day}.`);
        if (allPeriodShifts.some((s: ShiftRecord) => s.doctorId === ex.targetDoctorId && s.id !== ex.targetShiftId && s.day === reqS.day))
            conflicts.push(`${tgtDoc?.name} already has a shift on Day ${reqS.day}.`);
        if (reqS.wardId === 'referral' && tgtDoc?.gender !== 'Male')
            conflicts.push(`Referral calls require male physicians â€” ${tgtDoc?.name} is ${tgtDoc?.gender}.`);
        if (tgtS.wardId === 'referral' && reqDoc?.gender !== 'Male')
            conflicts.push(`Referral calls require male physicians â€” ${reqDoc?.name} is ${reqDoc?.gender}.`);
        return { conflicts, safe: conflicts.length === 0 };
    };

    const put = (id: string, body: object) =>
        fetch(`/api/exchanges/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    const submitRequest = async () => {
        if (!myShiftId || !targetDoctorId || !targetShiftId) { alert('Select all fields.'); return; }
        setSubmitting(true);
        const ex: ShiftExchange = {
            id: `ex-${Date.now()}`, requesterId: myId, requesterShiftId: myShiftId,
            targetDoctorId, targetShiftId, period, message,
            status: 'pending_target', createdAt: new Date().toISOString()
        };
        await fetch('/api/exchanges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ex) });
        setMyShiftId(''); setTargetDoctorId(''); setTargetShiftId(''); setMessage('');
        await fetch_(); setTab('outgoing'); setSubmitting(false);
        alert('Request sent. Waiting for the other doctor to accept.');
    };

    const respondToOffer = async (id: string, accept: boolean) => {
        setWorking(id);
        await put(id, { status: accept ? 'target_accepted' : 'target_declined', adminNote: '' });
        await fetch_();
        setWorking(null);
        alert(accept ? 'Accepted! The request is now in admin review.' : 'Offer declined.');
    };

    const adminResolve = async (id: string, approve: boolean) => {
        setWorking(id);
        const ex = exchanges.find(e => e.id === id);
        if (approve && ex) {
            if (!analyzeConflict(ex).safe && !confirm('Conflicts detected. Approve anyway?')) { setWorking(null); return; }
            const updated = staffing.shifts.map((s: ShiftRecord) => {
                if (s.id === ex.requesterShiftId) return { ...s, doctorId: ex.targetDoctorId };
                if (s.id === ex.targetShiftId)    return { ...s, doctorId: ex.requesterId };
                return s;
            });
            await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated.filter((s: ShiftRecord) => s.period === period)) });
        }
        await put(id, { status: approve ? 'approved' : 'rejected', adminNote: adminNote[id] || '' });
        await fetch_(); setWorking(null);
    };

    const statusBadge = (st: string) => {
        const map: Record<string, string> = {
            pending_target:  'bg-amber-100 text-amber-700',
            target_accepted: 'bg-blue-100 text-blue-700',
            target_declined: 'bg-red-100 text-red-500',
            approved:        'bg-emerald-100 text-emerald-700',
            rejected:        'bg-red-100 text-red-600',
        };
        const labels: Record<string, string> = {
            pending_target: 'Awaiting Response', target_accepted: 'Pending Admin',
            target_declined: 'Declined', approved: 'Approved', rejected: 'Rejected'
        };
        return <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-widest ${map[st] || 'bg-slate-100 text-slate-500'}`}>{labels[st] || st}</span>;
    };

    const ExchangeCard = ({ ex, showTargetActions, showAdminActions }: { ex: ShiftExchange, showTargetActions?: boolean, showAdminActions?: boolean }) => {
        const requester = staffing.doctorMap.get(ex.requesterId);
        const target    = staffing.doctorMap.get(ex.targetDoctorId);
        const reqShift  = staffing.shifts.find((s: ShiftRecord) => s.id === ex.requesterShiftId);
        const tgtShift  = staffing.shifts.find((s: ShiftRecord) => s.id === ex.targetShiftId);
        const analysis  = analyzeConflict(ex);
        const borderColor = ex.status === 'approved' ? 'border-emerald-200' : ex.status === 'target_declined' || ex.status === 'rejected' ? 'border-red-100' : ex.status === 'target_accepted' ? 'border-blue-200' : 'border-amber-200';
        const headerBg   = ex.status === 'approved' ? 'bg-emerald-50/40' : ex.status === 'target_declined' || ex.status === 'rejected' ? 'bg-red-50/30' : ex.status === 'target_accepted' ? 'bg-blue-50/40' : 'bg-amber-50/40';
        return (
            <div className={`bg-white rounded-3xl border shadow-sm overflow-hidden ${borderColor}`}>
                <div className={`px-6 py-4 flex items-center justify-between ${headerBg}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">{requester?.name?.charAt(0)}</div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{requester?.name} <span className="text-slate-400 font-normal">â†’</span> {target?.name}</p>
                            <p className="text-[10px] text-slate-400">{new Date(ex.createdAt).toLocaleString()}</p>
                        </div>
                    </div>
                    {statusBadge(ex.status)}
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-3 items-center">
                        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1">{requester?.name} gives</p>
                            <p className="text-xs font-bold text-slate-800">{reqShift ? getShiftLabel(reqShift) : <span className="text-red-400">Not found</span>}</p>
                        </div>
                        <div className="flex justify-center"><ArrowRightLeft className="w-5 h-5 text-slate-300" /></div>
                        <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{target?.name} gives</p>
                            <p className="text-xs font-bold text-slate-800">{tgtShift ? getShiftLabel(tgtShift) : <span className="text-red-400">Not found</span>}</p>
                        </div>
                    </div>
                    <div className={`p-3 rounded-2xl border text-xs ${analysis.safe ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
                        <p className="font-bold flex items-center gap-1 mb-1">
                            {analysis.safe ? <><CircleCheck className="w-3.5 h-3.5"/>No Conflicts</> : <><TriangleAlert className="w-3.5 h-3.5"/>Conflicts Detected</>}
                        </p>
                        {analysis.conflicts.map((c, i) => <p key={i} className="font-medium">â€¢ {c}</p>)}
                    </div>
                    {ex.message && <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 italic">"{ex.message}"</div>}
                    {ex.adminNote && <div className="bg-slate-50 p-3 rounded-xl border border-slate-100"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Admin Note</p><p className="text-xs text-slate-600">"{ex.adminNote}"</p></div>}

                    {/* Target doctor response buttons */}
                    {showTargetActions && (
                        <div className="pt-2 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Your Response to This Offer</p>
                            <div className="flex gap-3">
                                <button onClick={() => respondToOffer(ex.id, true)} disabled={working === ex.id}
                                    className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                    <Check className="w-4 h-4" /> Accept Offer
                                </button>
                                <button onClick={() => respondToOffer(ex.id, false)} disabled={working === ex.id}
                                    className="flex-1 bg-white text-red-500 border border-red-200 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                    <X className="w-4 h-4" /> Decline
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Admin approve/reject */}
                    {showAdminActions && (
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Both parties agreed â€” Final Decision</p>
                            <textarea value={adminNote[ex.id] || ''} onChange={e => setAdminNote(p => ({ ...p, [ex.id]: e.target.value }))}
                                placeholder="Optional admin note..." rows={2}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 resize-none" />
                            <div className="flex gap-3">
                                <button onClick={() => adminResolve(ex.id, true)} disabled={working === ex.id}
                                    className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50">
                                    <Check className="w-4 h-4" /> Approve & Apply
                                </button>
                                <button onClick={() => adminResolve(ex.id, false)} disabled={working === ex.id}
                                    className="flex-1 bg-white text-red-500 border border-red-200 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-red-50 flex items-center justify-center gap-2 disabled:opacity-50">
                                    <X className="w-4 h-4" /> Reject
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const EmptyState = ({ msg }: { msg: string }) => (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <ArrowRightLeft className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold text-sm">{msg}</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3"><ArrowRightLeft className="w-6 h-6 text-emerald-500" /> Shift Exchange</h2>
                    <p className="text-sm text-slate-500 mt-1">Both parties must agree before admin reviews the request.</p>
                </div>
                <div className="flex items-center gap-3">
                    <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none" />
                    <button onClick={fetch_} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"><RefreshCw className="w-4 h-4 text-slate-500" /></button>
                </div>
            </div>

            {/* Stage indicator */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span> Doctor A proposes</span>
                <ChevronRight className="w-4 h-4 hidden sm:block text-slate-300" />
                <span className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span> Doctor B accepts / declines</span>
                <ChevronRight className="w-4 h-4 hidden sm:block text-slate-300" />
                <span className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">3</span> Admin approves &amp; applies</span>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
                {!isAdmin && <>
                    <button onClick={() => setTab('request')} className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${tab === 'request' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>+ New Request</button>
                    <button onClick={() => setTab('outgoing')} className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${tab === 'outgoing' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>My Sent Requests</button>
                    <button onClick={() => setTab('incoming')} className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${tab === 'incoming' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                        Incoming Offers {incomingCount > 0 && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">{incomingCount}</span>}
                    </button>
                </>}
                {isAdmin && (
                    <button onClick={() => setTab('admin')} className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${tab === 'admin' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                        Review Queue {adminCount > 0 && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">{adminCount}</span>}
                    </button>
                )}
            </div>

            {loading && <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>}

            {/* New Request Form */}
            {!loading && tab === 'request' && !isAdmin && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-emerald-500" /> Propose Exchange</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">My Shift to Give Away</label>
                            <select value={myShiftId} onChange={e => setMyShiftId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700">
                                <option value="">â€” Select your shift â€”</option>
                                {myShifts.map((s: ShiftRecord) => <option key={s.id} value={s.id}>{getShiftLabel(s)}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Swap With Doctor</label>
                            <select value={targetDoctorId} onChange={e => { setTargetDoctorId(e.target.value); setTargetShiftId(''); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700">
                                <option value="">â€” Select doctor â€”</option>
                                {staffing.doctors.filter((d: Doctor) => d.id !== myId && d.id !== 'root').map((d: Doctor) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        {targetDoctorId && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Their Shift I Want</label>
                                <select value={targetShiftId} onChange={e => setTargetShiftId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700">
                                    <option value="">â€” Select shift â€”</option>
                                    {targetShifts.map((s: ShiftRecord) => <option key={s.id} value={s.id}>{getShiftLabel(s)}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Note (optional)</label>
                            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Reason for exchange..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 resize-none" />
                        </div>
                    </div>
                    <button onClick={submitRequest} disabled={submitting} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50">
                        <ArrowRightLeft className="w-4 h-4" /> Send Offer to Doctor
                    </button>
                </div>
            )}

            {/* My outgoing requests */}
            {!loading && tab === 'outgoing' && !isAdmin && (
                <div className="space-y-4">
                    {outgoing.length === 0 ? <EmptyState msg="No outgoing requests for this period." /> : outgoing.map(ex => <React.Fragment key={ex.id}><ExchangeCard ex={ex} /></React.Fragment>)}
                </div>
            )}

            {/* Incoming offers for target doctor */}
            {!loading && tab === 'incoming' && !isAdmin && (
                <div className="space-y-4">
                    {incoming.length === 0
                        ? <EmptyState msg="No incoming offers awaiting your response." />
                        : incoming.map(ex => <React.Fragment key={ex.id}><ExchangeCard ex={ex} showTargetActions /></React.Fragment>)}
                </div>
            )}

            {/* Admin review queue â€” only target_accepted */}
            {!loading && tab === 'admin' && isAdmin && (
                <div className="space-y-4">
                    {adminQueue.length === 0
                        ? <EmptyState msg="No mutually-agreed requests awaiting admin review." />
                        : adminQueue.map(ex => <React.Fragment key={ex.id}><ExchangeCard ex={ex} showAdminActions /></React.Fragment>)}
                    {periodEx.filter(e => e.status !== 'target_accepted' && e.status !== 'pending_target').length > 0 && (
                        <div className="mt-8">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Resolved History</p>
                            <div className="space-y-3">{periodEx.filter(e => ['approved','rejected','target_declined'].includes(e.status)).map(ex => <React.Fragment key={ex.id}><ExchangeCard ex={ex} /></React.Fragment>)}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});



const ControlPanelView = React.memo(({ staffing }: { staffing: any }) => {
    const [selectedDocId, setSelectedDocId] = useState<string>('');
    const [microPeriod, setMicroPeriod] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [ruleType, setRuleType] = useState<'max_er_shifts' | 'forbidden_days' | 'ward_restriction'>('forbidden_days');
    const [ruleValue, setRuleValue] = useState<string>('');

    const selectedDoc = staffing.doctors.find((d: any) => d.id === selectedDocId);
    const docShifts = staffing.shifts.filter((s: any) => s.doctorId === selectedDocId && s.period === microPeriod);

    const defaultSlots = { referral: [1], men: [2, 4, 4, 2], women: [2, 4, 4, 2], pediatric: [1, 1, 1] };
    const slots = staffing.erConfig?.slots || defaultSlots;
    const durations = staffing.erConfig?.durations || { referral: 24, men: 6, women: 6, pediatric: 8 };
    const fatigueGap = staffing.erConfig?.fatigueGap ?? 12;
    const balanceThreshold = staffing.erConfig?.balanceThreshold ?? 12;
    const referralMaleOnly = staffing.erConfig?.referralMaleOnly !== false;
    const referralBufferDays = staffing.erConfig?.referralBufferDays ?? 1;

    const handleUpdateSlots = (category: 'referral' | 'men' | 'women' | 'pediatric', slotIdx: number, val: number) => {
        if (val < 0) return;
        const newSlots = { ...slots };
        newSlots[category] = [...(slots[category] || [])];
        newSlots[category][slotIdx] = val;
        staffing.updateERConfig({ ...staffing.erConfig, slots: newSlots });
    };

    const handleUpdateDuration = (category: 'referral' | 'men' | 'women' | 'pediatric', val: number) => {
        if (val < 1) return;
        staffing.updateERConfig({ ...staffing.erConfig, durations: { ...durations, [category]: val } });
    };

    const handleAddSlot = (category: 'men' | 'women' | 'pediatric') => {
        const newSlots = { ...slots, [category]: [...(slots[category] || []), 1] };
        staffing.updateERConfig({ ...staffing.erConfig, slots: newSlots });
    };

    const handleRemoveSlot = (category: 'men' | 'women' | 'pediatric') => {
        if ((slots[category] || []).length <= 1) return;
        const newSlots = { ...slots, [category]: (slots[category] || []).slice(0, -1) };
        staffing.updateERConfig({ ...staffing.erConfig, slots: newSlots });
    };

    const addRule = () => {
        if (!selectedDocId || !ruleValue) return;
        const doc = staffing.doctors.find((d: any) => d.id === selectedDocId);
        if (!doc) return;
        const newRule = { id: `rule-${Date.now()}`, type: ruleType, value: ruleValue };
        const updatedDoc = { ...doc, rules: [...(doc.rules || []), newRule] };
        staffing.updateDoctor(updatedDoc);
        setRuleValue('');
    };

    const removeRule = (ruleId: string) => {
        const doc = staffing.doctors.find((d: any) => d.id === selectedDocId);
        if (!doc) return;
        staffing.updateDoctor({ ...doc, rules: (doc.rules || []).filter((r: any) => r.id !== ruleId) });
    };

    const updateWardWeight = (wardId: string, weight: number) => {
        const ward = staffing.wards.find((w: Ward) => w.id === wardId);
        if (!ward) return;
        staffing.updateWard({ ...ward, requirements: { ...ward.requirements, shiftWeight: weight } });
    };

    return (
        <div className="space-y-8 pb-20">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Master Control Panel</h2>
                <p className="text-sm text-slate-500">Configure all operational parameters for the staffing engine.</p>
            </div>

            {/* ER Capacity Configuration */}
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-amber-500" /> ER Capacity Configuration</h3>
                <p className="text-sm text-slate-500 mb-6">Configure every aspect of ER scheduling â€” slot counts, time windows, hour weights, fatigue gaps, and referral rules.</p>

                {/* Global ER Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4 bg-amber-50/40 rounded-2xl border border-amber-100">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fatigue Safety Gap (hours)</label>
                        <p className="text-[9px] text-slate-400">Min rest between ER shifts across days</p>
                        <input type="number" min="0" max="24" value={fatigueGap}
                            onChange={e => staffing.updateERConfig({ ...staffing.erConfig, fatigueGap: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold text-center" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Equity Balance Threshold (hours)</label>
                        <p className="text-[9px] text-slate-400">Max allowed hour gap before auto-balance triggers</p>
                        <input type="number" min="0" value={balanceThreshold}
                            onChange={e => staffing.updateERConfig({ ...staffing.erConfig, balanceThreshold: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold text-center" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Referral Buffer (days)</label>
                        <p className="text-[9px] text-slate-400">Shifts blocked before &amp; after each referral call</p>
                        <input type="number" min="0" max="7" value={referralBufferDays}
                            onChange={e => staffing.updateERConfig({ ...staffing.erConfig, referralBufferDays: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold text-center" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Referral: Male Doctors Only</label>
                        <p className="text-[9px] text-slate-400">Restrict daily referral calls to male physicians</p>
                        <button onClick={() => staffing.updateERConfig({ ...staffing.erConfig, referralMaleOnly: !referralMaleOnly })}
                            className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors border ${referralMaleOnly ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                            {referralMaleOnly ? 'âœ“ Male Only' : 'âœ— All Genders'}
                        </button>
                    </div>
                </div>

                {/* Per-category slot grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {(['referral', 'men', 'women', 'pediatric'] as const).map(cat => (
                        <div key={cat} className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                                    {cat === 'referral' ? 'Referral Call' : `ER - ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
                                </h4>
                                {cat !== 'referral' && (
                                    <div className="flex gap-1">
                                        <button onClick={() => handleAddSlot(cat)} className="w-5 h-5 rounded bg-green-100 text-green-600 font-bold text-xs hover:bg-green-200 transition-colors">+</button>
                                        <button onClick={() => handleRemoveSlot(cat)} className="w-5 h-5 rounded bg-red-100 text-red-600 font-bold text-xs hover:bg-red-200 transition-colors">âˆ’</button>
                                    </div>
                                )}
                            </div>
                            {/* Duration weight */}
                            <div className="flex items-center justify-between bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase">Hour Weight (h)</span>
                                <input type="number" min="1" max="48"
                                    value={durations[cat] ?? (cat === 'referral' ? 24 : cat === 'pediatric' ? 8 : 6)}
                                    onChange={e => handleUpdateDuration(cat, parseInt(e.target.value) || 1)}
                                    className="w-16 bg-white border border-indigo-200 rounded p-1 text-xs font-bold text-center" />
                            </div>
                            {/* Slots */}
                            <div className="space-y-2">
                                {(slots[cat] || [1]).map((count: number, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Slot {idx + 1}</span>
                                        <input type="number" min="0" max="20" value={count}
                                            onChange={e => handleUpdateSlots(cat, idx, parseInt(e.target.value) || 0)}
                                            className="w-16 bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Ward Shift Weights */}
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2"><Hospital className="w-4 h-4 text-blue-500" /> Ward Shift Weights</h3>
                <p className="text-sm text-slate-500 mb-6">Override the default hour weighting for each ward shift in equity calculations.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {staffing.wards.filter((w: Ward) => !w.parentWardId).map((w: Ward) => (
                        <div key={w.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div>
                                <p className="text-xs font-bold text-slate-800">{w.name}</p>
                                <p className="text-[9px] text-slate-400 uppercase">{w.requirements.shiftDuration} default</p>
                            </div>
                            <input type="number" min="1" max="48"
                                value={w.requirements.shiftWeight ?? (w.requirements.shiftDuration === '6h' ? 6 : w.requirements.shiftDuration === '12h' ? 12 : 24)}
                                onChange={e => updateWardWeight(w.id, parseInt(e.target.value) || 1)}
                                className="w-16 bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold text-center" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Doctor-Specific Rules */}
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-500" /> Clinician Scheduling Rules</h3>
                <p className="text-sm text-slate-500 mb-6">Apply per-doctor constraints that the scheduling engine will respect.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <select value={selectedDocId} onChange={e => setSelectedDocId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700">
                            <option value="">â€” Select Doctor â€”</option>
                            {staffing.doctors.filter((d: Doctor) => d.id !== 'root').map((d: Doctor) =>
                                <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {selectedDocId && (
                            <div className="space-y-3">
                                <input type="month" value={microPeriod} onChange={e => setMicroPeriod(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700" />
                                <select value={ruleType} onChange={e => setRuleType(e.target.value as any)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700">
                                    <option value="forbidden_days">Forbidden Days</option>
                                    <option value="max_er_shifts">Max ER Shifts</option>
                                    <option value="ward_restriction">Ward Restriction</option>
                                </select>
                                <input type="text" value={ruleValue} onChange={e => setRuleValue(e.target.value)}
                                    placeholder={ruleType === 'forbidden_days' ? 'e.g. 5,10,15' : ruleType === 'max_er_shifts' ? 'e.g. 3' : 'Ward ID'}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700" />
                                <button onClick={addRule}
                                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all">
                                    Add Rule
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        {selectedDoc && (selectedDoc.rules || []).length === 0 && (
                            <p className="text-slate-400 text-sm italic">No rules configured for {selectedDoc.name}.</p>
                        )}
                        {(selectedDoc?.rules || []).map((rule: any) => (
                            <div key={rule.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div>
                                    <p className="text-xs font-bold text-slate-700 uppercase">{rule.type.replace(/_/g, ' ')}</p>
                                    <p className="text-xs text-slate-500">{rule.value}</p>
                                </div>
                                <button onClick={() => removeRule(rule.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Doctor Shifts Preview */}
            {selectedDocId && (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" /> Shift Preview â€” {selectedDoc?.name}
                    </h3>
                    {docShifts.length === 0 ? (
                        <p className="text-slate-400 text-sm italic">No shifts assigned for {microPeriod}.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {docShifts.sort((a: any, b: any) => a.day - b.day).map((s: any) => {
                                const wardName = s.wardId === 'referral' ? 'Referral Call'
                                    : s.wardId.startsWith('er-') ? `ER ${s.wardId.replace('er-', '').toUpperCase()}`
                                    : staffing.wardMap.get(s.wardId)?.name || s.wardId;
                                return (
                                    <div key={s.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Day {s.day}</p>
                                        <p className="text-xs font-bold text-slate-800 mt-0.5">{wardName}</p>
                                        <p className="text-[9px] text-slate-500">{getSlotName(s.slotIndex ?? 0, s.wardId)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            {/* Danger Zone */}
            <div className="bg-red-50 rounded-[32px] border border-red-200 shadow-sm p-8">
                <h3 className="text-sm font-bold text-red-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-red-500" /> Danger Zone
                </h3>
                <p className="text-sm text-red-500 mb-6">
                    These actions are <span className="font-bold">irreversible</span>. Proceed with extreme caution.
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-red-200 rounded-2xl p-5">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Purge Doctor &amp; Ward Registry</p>
                        <p className="text-xs text-slate-500 mt-0.5">Permanently deletes <span className="font-semibold text-red-600">all doctors and all wards</span> from the database. Assignments and shifts are not affected.</p>
                    </div>
                    <button
                        onClick={async () => {
                            if (!confirm('⚠️ This will permanently delete ALL doctors and ALL wards from the database.\n\nThis action cannot be undone.\n\nType "DELETE" in the next prompt to confirm.')) return;
                            const typed = window.prompt('Type DELETE to confirm:');
                            if (typed !== 'DELETE') { alert('Cancelled — input did not match.'); return; }
                            await staffing.clearDatabase();
                            alert('Doctor and ward registry has been purged.');
                        }}
                        className="shrink-0 flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-red-600/20 text-sm"
                    >
                        <Trash2 className="w-4 h-4" /> Clear Doctors &amp; Wards
                    </button>
                </div>
            </div>
        </div>
    );
});
