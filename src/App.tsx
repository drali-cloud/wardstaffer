import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Hospital, ClipboardList, FileUp, Plus, Trash2, Download, Calendar, ChevronRight, UserPlus, Edit2, RefreshCw, Archive, Save, ChevronLeft, User, LogOut, Shield, Clock, MapPin, Lock, Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStaffingData } from './hooks/useStaffingData';
import { Doctor, Ward, Gender, Assignment } from './types';
import * as XLSX from 'xlsx';

type View = 'dashboard' | 'doctors' | 'wards' | 'archive' | 'assignments' | 'profile';
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
  const [selectedMonth, setSelectedMonth] = useState<{year: number, month: number} | null>(null);
  const staffing = useStaffingData();

  useEffect(() => {
      if (user) localStorage.setItem('wardstaffer_user', JSON.stringify(user));
      else localStorage.removeItem('wardstaffer_user');
  }, [user]);

  const handleLogin = React.useCallback((name: string, pass: string) => {
      if (name === 'root' && pass === 'root') {
          setUser({ id: 'root', name: 'System Root', role: 'admin' });
          return true;
      }
      const doc = staffing.doctors.find(d => d.name === name);
      if (doc) {
          const correctPass = doc.password || '11111111';
          if (pass === correctPass) {
              setUser({ id: doc.id, name: doc.name, role: 'resident' });
              return true;
          }
      }
      return false;
  }, [staffing.doctors]);

  const handleLogout = React.useCallback(() => {
      setUser(null);
      setCurrentView('dashboard');
  }, []);

  if (!user) return <LoginPage onLogin={handleLogin} isLoading={staffing.loading} />;

  const handleExport = () => {
    const doctorsWs = XLSX.utils.json_to_sheet(staffing.doctors.map(d => ({ ID: d.id, Name: d.name, Gender: d.gender, PreviousWards: d.previousWards.join(', ') })));
    const wardsWs = XLSX.utils.json_to_sheet(staffing.wards.map(w => ({ ID: w.id, Name: w.name, 'Staff Required': w.requirements.totalDoctors, 'Diversity': w.requirements.genderDiversity })));
    const dates = [...new Set(staffing.assignments.map(a => a.date))].sort();
    const gridRows: any[] = [];
    dates.forEach(date => {
        const dateAssignments = staffing.assignments.filter(a => a.date === date);
        let maxDocs = 0; const wardToDocs: Record<string, string[]> = {};
        staffing.wards.forEach(w => {
            const assignment = dateAssignments.find(a => a.wardId === w.id);
            const docNames = (assignment?.doctorIds || []).map(id => staffing.doctorMap.get(id)?.name || 'Unknown');
            wardToDocs[w.name] = docNames; maxDocs = Math.max(maxDocs, docNames.length);
        });
        for (let i = 0; i < maxDocs; i++) {
            const row: any = { 'Date': i === 0 ? date : '' };
            staffing.wards.forEach(w => { row[w.name] = wardToDocs[w.name][i] || ''; });
            gridRows.push(row);
        }
        gridRows.push({});
    });
    const gridWs = XLSX.utils.json_to_sheet(gridRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, gridWs, "Schedule Grid");
    XLSX.utils.book_append_sheet(wb, doctorsWs, "Registry");
    XLSX.utils.book_append_sheet(wb, wardsWs, "Config");
    XLSX.writeFile(wb, `Dispatch_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' });
            const findKey = (row: any, patterns: string[]) => { const key = Object.keys(row).find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase()))); return key ? row[key] : null; };
            const docWs = wb.Sheets[wb.SheetNames[0]];
            if (docWs) {
                const docData = XLSX.utils.sheet_to_json(docWs) as any[];
                const imported = docData.map(d => ({
                    id: Math.random().toString(36).substr(2, 9),
                    name: (findKey(d, ['name', 'doctor']) || "Unnamed").toString(),
                    gender: (findKey(d, ['gender', 'sex']) || "Male").toString() as Gender,
                    previousWards: (findKey(d, ['previous', 'pw']) || "").toString().split(',').map((s: string) => s.trim()).filter(Boolean)
                }));
                staffing.importData({ doctors: imported });
            }
        } catch (err) { alert('Import failed.'); }
    };
    reader.readAsBinaryString(file);
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
          <NavItem active={currentView === 'profile'} onClick={() => setCurrentView('profile')} label="My Profile" icon={<User className="w-4 h-4" />} />
          <div className="h-px bg-slate-800 my-4"></div>
          <NavItem active={currentView === 'doctors'} onClick={() => setCurrentView('doctors')} label="Staff Registry" icon={<Users className="w-4 h-4" />} />
          <NavItem active={currentView === 'wards'} onClick={() => setCurrentView('wards')} label="Ward Config" icon={<Hospital className="w-4 h-4" />} />
          <NavItem active={currentView === 'archive'} onClick={() => { setCurrentView('archive'); setSelectedMonth(null); }} label="Monthly Archive" icon={<Archive className="w-4 h-4" />} />
          <NavItem active={currentView === 'assignments'} onClick={() => setCurrentView('assignments')} label="History Logs" icon={<Calendar className="w-4 h-4" />} />
        </nav>
        <div className="p-6 border-t border-slate-800 bg-slate-950/50">
          <div className="space-y-4">
              <div className="flex items-center space-x-3 mb-2"><div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">{user.name.charAt(0)}</div><div className="overflow-hidden"><p className="text-xs font-bold text-white truncate">{user.name}</p><p className="text-[10px] text-slate-500 uppercase tracking-widest">{user.role}</p></div></div>
              {user.role === 'admin' && (<div className="space-y-2 border-t border-slate-800 pt-3"><button onClick={handleExport} className="w-full flex items-center space-x-3 text-xs text-slate-400 hover:text-white transition-colors"><Download className="w-3 h-3" /> <span>Export Dataset</span></button><label className="w-full flex items-center space-x-3 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"><FileUp className="w-3 h-3" /> <span>Import Excel</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} /></label></div>)}
              <button onClick={handleLogout} className="w-full flex items-center space-x-3 text-xs text-red-400 hover:text-red-300 transition-colors pt-2 border-t border-slate-800"><LogOut className="w-3 h-3" /> <span>Sign Out</span></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm shrink-0 z-20">
          <div className="flex items-center space-x-3"><h1 className="text-lg font-semibold text-slate-800 capitalize">{currentView === 'archive' && selectedMonth ? `${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(selectedMonth.year, selectedMonth.month))}` : currentView}</h1><div className="h-4 w-[1px] bg-slate-200"></div><div className="flex items-center text-[10px] text-slate-400 uppercase font-bold tracking-wider"><span>{user.role}</span><ChevronRight className="w-3 h-3" /> <span className="text-blue-600">{currentView}</span></div></div>
          {staffing.syncing && (<div className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /><span>Syncing...</span></div>)}
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50"><div className="max-w-7xl mx-auto"><AnimatePresence mode="wait"><motion.div key={currentView + (selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
          {currentView === 'dashboard' && <DashboardView staffing={staffing} user={user} />}
          {currentView === 'doctors' && <DoctorsView staffing={staffing} user={user} />}
          {currentView === 'wards' && <WardsView staffing={staffing} user={user} />}
          {currentView === 'archive' && <MonthlyArchiveView staffing={staffing} selectedMonth={selectedMonth} onSelect={setSelectedMonth} />}
          {currentView === 'assignments' && <AssignmentsView staffing={staffing} />}
          {currentView === 'profile' && <ProfileView staffing={staffing} user={user} />}
        </motion.div></AnimatePresence></div></div>
      </main>
    </div>
  );
}

function LoginPage({ onLogin, isLoading }: { onLogin: (u: string, p: string) => boolean, isLoading: boolean }) {
    const [name, setName] = useState(''); const [pass, setPass] = useState(''); const [error, setError] = useState(false);
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (isLoading) return;
        if (onLogin(name, pass)) setError(false); else setError(true); 
    };
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-8 space-y-8">
                <div className="text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/20">
                        <Hospital className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">WardStaffer Portal</h1>
                    <p className="text-slate-500 text-sm mt-2">Relational Clinical Deployment System</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medical Staff Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                            <input 
                                type="text" 
                                placeholder="Full Registered Name" 
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all disabled:opacity-50" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Security Access Key</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                            <input 
                                type="password" 
                                placeholder="Key" 
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all disabled:opacity-50" 
                                value={pass} 
                                onChange={e => setPass(e.target.value)} 
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                    {error && (<div className="bg-red-500/10 border border-red-500/50 text-red-500 text-[10px] uppercase font-bold p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Invalid Credentials</div>)}
                    
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:bg-slate-700 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing Database...</>
                        ) : (
                            "Authenticate & Access"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

function ProfileView({ staffing, user }: { staffing: any, user: AuthUser }) {
    const doctor = staffing.doctors.find((d: any) => d.name === user.name);
    const myAssignments = staffing.assignments.filter((a: any) => a.doctorIds.includes(user.id)).sort((a: any, b: any) => b.date.localeCompare(a.date));
    const [newPass, setNewPass] = useState('');
    const [changing, setChanging] = useState(false);

    const handlePassChange = async () => {
        if (!doctor || newPass.length < 4) { alert('Password must be at least 4 characters.'); return; }
        setChanging(true);
        await staffing.updateDoctor({ ...doctor, password: newPass });
        setChanging(false);
        setNewPass('');
        alert('Password updated successfully.');
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl font-bold text-blue-600 border border-blue-100">{user.name.charAt(0)}</div>
                    <div><h2 className="text-2xl font-bold text-slate-900">{user.name}</h2><div className="flex items-center gap-3 mt-2"><span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-full border border-slate-200">ID: {user.id}</span><span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-full">{user.role}</span></div></div>
                </div>
                {user.id !== 'root' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Update Access Key</label>
                        <div className="flex gap-2">
                            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="New Password" className="text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={handlePassChange} disabled={changing} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"><Key className="w-4 h-4" /></button>
                        </div>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="technical-card p-6"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Current Deployment</h3>{myAssignments[0] ? (<div className="p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="text-[10px] text-blue-500 font-bold uppercase mb-1">Assigned Ward</p><p className="text-xl font-bold text-blue-900">{staffing.wardMap.get(myAssignments[0].wardId)?.name}</p><div className="mt-4 flex items-center gap-2 text-xs font-medium text-blue-700"><Clock className="w-4 h-4" /> Since {myAssignments[0].date}</div></div>) : (<p className="text-xs text-slate-400 italic py-8 text-center">No active assignments.</p>)}</div>
                <div className="technical-card p-6"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Professional History</h3><div className="flex flex-wrap gap-2">{doctor?.previousWards?.map((wId: string) => (<span key={wId} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-200">{staffing.wardMap.get(wId)?.name || wId}</span>)) || <p className="text-xs text-slate-400 italic">No history.</p>}</div></div>
            </div>
            <div className="technical-card overflow-hidden"><div className="px-6 py-4 border-b border-slate-100 bg-white"><h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Recent Assignments</h3></div><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Date</th><th className="col-header">Ward Unit</th><th className="col-header text-right">Reference</th></tr></thead><tbody className="text-sm divide-y divide-slate-100">{myAssignments.slice(0, 10).map((a: any) => (<tr key={a.id}><td className="px-6 py-4 font-mono text-blue-600 text-[10px] font-bold">{a.date}</td><td className="px-6 py-4 font-semibold text-slate-700">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-4 text-right text-[10px] text-slate-300 font-mono">{a.id}</td></tr>))}</tbody></table></div>
        </div>
    );
}

const DashboardView = React.memo(({ staffing, user }: { staffing: any, user: AuthUser }) => {
  const totalRequired = staffing.wards.reduce((acc: number, w: any) => acc + (w.requirements.totalDoctors || 0), 0);
  const myAssignment = staffing.assignments.filter((a: any) => a.doctorIds.includes(user.id)).sort((a: any, b: any) => b.date.localeCompare(a.date))[0];
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"><div className="relative z-10"><h2 className="text-2xl font-bold">Welcome, {user.name}</h2><p className="text-blue-100 mt-2 text-sm max-w-lg">{user.role === 'admin' ? "System root access active." : myAssignment ? `Assigned to ${staffing.wardMap.get(myAssignment.wardId)?.name} on ${myAssignment.date}.` : "No active assignments."}</p></div><Hospital className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/10 rotate-12" /></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6"><StatCard label="Active Personnel" value={staffing.doctors.length} icon={<Users className="w-5 h-5 text-blue-600" />} /><StatCard label="Daily Quota" value={totalRequired} icon={<UserPlus className="w-5 h-5 text-amber-600" />} /><StatCard label="Operating Wards" value={staffing.wards.length} icon={<Hospital className="w-5 h-5 text-blue-600" />} /><StatCard label="Total History" value={staffing.assignments.length} icon={<Calendar className="w-5 h-5 text-blue-600" />} /></div>
      <div className="grid grid-cols-12 gap-6">{user.role === 'admin' ? (<div className="col-span-12 lg:col-span-5 space-y-6"><div className="technical-card p-6 border-blue-100 ring-1 ring-blue-50"><h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Save className="w-4 h-4 text-blue-600" /> Batch Dispatch</h2><input type="month" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg mb-4" defaultValue={new Date().toISOString().slice(0, 7)} id="batch-month" /><button disabled={staffing.syncing} onClick={async () => { const [y, m] = (document.getElementById('batch-month') as HTMLInputElement).value.split('-').map(Number); if (confirm(`Generate for ${y}-${m}?`)) await staffing.generateMonthAssignments(y, m - 1); }} className="btn-primary w-full justify-center py-2.5">Generate Month</button></div></div>) : (<div className="col-span-12 lg:col-span-5"><div className="technical-card p-6 h-full flex flex-col items-center justify-center text-center space-y-4"><div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center"><MapPin className="w-8 h-8 text-blue-600" /></div><div><h3 className="font-bold text-slate-800">Next Deployment</h3></div>{myAssignment ? (<div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6"><p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Ward</p><p className="text-xl font-bold text-blue-600">{staffing.wardMap.get(myAssignment.wardId)?.name}</p></div>) : (<div className="w-full border-2 border-dashed border-slate-100 rounded-2xl p-8 text-slate-300 text-xs italic">No upcoming assignments.</div>)}</div></div>)}<div className="col-span-12 lg:col-span-7"><div className="technical-card overflow-hidden h-full"><div className="px-6 py-4 border-b border-slate-100 bg-white"><h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Registry Activity</h3></div><div className="overflow-x-auto"><table className="technical-grid"><tbody className="text-sm divide-y divide-slate-100">{staffing.assignments.slice(-8).reverse().map((a: Assignment) => (<tr key={a.id}><td className="px-6 py-3 text-[10px] font-mono text-slate-400">{a.date}</td><td className="px-6 py-3 font-semibold text-slate-700">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-3 text-[10px] text-blue-600 font-bold uppercase">{a.doctorIds.length} Assigned</td></tr>))}</tbody></table></div></div></div></div>
    </div>
  );
});

const DoctorsView = React.memo(({ staffing, user }: { staffing: any, user: AuthUser }) => {
  const [showAdd, setShowAdd] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({ name: '', gender: 'Male', previousWards: [] });
  const filtered = useMemo(() => staffing.doctors.filter((d: any) => d.id !== 'root'), [staffing.doctors]);
  const handleAdd = () => { if (!newDoctor.name) return; const payload = { id: editingId || Math.random().toString(36).substr(2, 9), name: newDoctor.name.trim(), gender: newDoctor.gender as Gender, previousWards: newDoctor.previousWards || [] }; if (editingId) staffing.updateDoctor(payload); else staffing.addDoctor(payload); setShowAdd(false); setEditingId(null); setNewDoctor({ name: '', gender: 'Male', previousWards: [] }); };
  return (<div className="space-y-6"><div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div><h2 className="text-xl font-bold text-slate-800">Personnel Registry</h2></div>{user.role === 'admin' && (<button className="btn-primary" onClick={() => setShowAdd(!showAdd)}><UserPlus className="w-4 h-4" /> Register</button>)}</div><AnimatePresence>{showAdd && user.role === 'admin' && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="technical-card p-8 bg-white mb-6 border-blue-100 ring-1 ring-blue-50"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label className="text-[10px] uppercase font-bold text-slate-400">Name</label><input type="text" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newDoctor.name} onChange={e => setNewDoctor(prev => ({ ...prev, name: e.target.value }))} /></div><div><label className="text-[10px] uppercase font-bold text-slate-400">Gender</label><select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newDoctor.gender} onChange={e => setNewDoctor(prev => ({ ...prev, gender: e.target.value as Gender }))}><option value="Male">Male</option><option value="Female">Female</option></select></div></div><div className="flex gap-3 mt-8 pt-6 border-t border-slate-100"><button className="btn-primary px-8" onClick={handleAdd}>Save</button></div></div></motion.div>)}</AnimatePresence><div className="technical-card overflow-hidden"><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Registry ID</th><th className="col-header">Name</th><th className="col-header">Gender</th>{user.role === 'admin' && <th className="col-header text-right">Actions</th>}</tr></thead><tbody className="text-sm divide-y divide-slate-100">{filtered.map((d: Doctor) => (<tr key={d.id} className="hover:bg-slate-50/50 group"><td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">{d.id}</td><td className="px-6 py-4 font-semibold text-slate-800">{d.name}</td><td className="px-6 py-4 text-xs"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${d.gender === 'Male' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-pink-50 text-pink-600 border-pink-100'}`}>{d.gender}</span></td>{user.role === 'admin' && <td className="px-6 py-4 text-right flex justify-end gap-2"><button className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100" onClick={() => { setEditingId(d.id); setNewDoctor(d); setShowAdd(true); }}><Edit2 className="w-4 h-4" /></button><button className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={() => { if(confirm('Delete?')) staffing.deleteDoctor(d.id); }}><Trash2 className="w-4 h-4" /></button></td>}</tr>))}</tbody></table></div></div>);
});

const WardsView = React.memo(({ staffing, user }: { staffing: any, user: AuthUser }) => {
    const [showAdd, setShowAdd] = useState(false); const [newWard, setNewWard] = useState<Partial<Ward>>({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None' } });
    const handleAdd = () => { if (!newWard.name) return; const wardData = { id: `ward-${Math.random().toString(36).substr(2, 5)}`, name: newWard.name.trim(), requirements: { totalDoctors: newWard.requirements?.totalDoctors || 2, genderDiversity: newWard.requirements?.genderDiversity || 'None' } }; staffing.addWard(wardData); setShowAdd(false); setNewWard({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None' } }); };
    return (<div className="space-y-6"><div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div><h2 className="text-xl font-bold text-slate-800">Unit Config</h2></div>{user.role === 'admin' && (<button className="btn-primary" onClick={() => setShowAdd(!showAdd)}><Plus className="w-4 h-4" /> Add Unit</button>)}</div><AnimatePresence>{showAdd && user.role === 'admin' && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="technical-card p-8 space-y-6 bg-white mb-6 border-blue-100 ring-1 ring-blue-50"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="text-[10px] uppercase font-bold text-slate-400">Designation</label><input type="text" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.name} onChange={e => setNewWard(prev => ({ ...prev, name: e.target.value }))} /></div><div><label className="text-[10px] uppercase font-bold text-slate-400">Quota</label><input type="number" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.totalDoctors} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, totalDoctors: parseInt(e.target.value) } }))} /></div></div><div className="flex gap-3 pt-6 border-t border-slate-100"><button className="btn-primary px-8" onClick={handleAdd}>Deploy</button></div></div></motion.div>)}</AnimatePresence><div className="technical-card overflow-hidden"><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">ID</th><th className="col-header">Name</th><th className="col-header">Capacity</th>{user.role === 'admin' && <th className="col-header text-right">Actions</th>}</tr></thead><tbody className="text-sm divide-y divide-slate-100">{staffing.wards.map((w: Ward) => (<tr key={w.id} className="hover:bg-slate-50/50 group"><td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">{w.id}</td><td className="px-6 py-4 font-semibold text-slate-800">{w.name}</td><td className="px-6 py-4"><span className="text-[10px] font-bold text-slate-500 uppercase">{w.requirements.totalDoctors} Staff</span></td>{user.role === 'admin' && <td className="px-6 py-4 text-right flex justify-end gap-2"><button className="p-1.5 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={() => { if(confirm('Remove?')) staffing.deleteWard(w.id); }}><Trash2 className="w-4 h-4" /></button></td>}</tr>))}</tbody></table></div></div>);
});

const MonthlyArchiveView = ({ staffing, selectedMonth, onSelect }: { staffing: any, selectedMonth: {year: number, month: number} | null, onSelect: (m: any) => void }) => {
    const months = useMemo(() => { const map = new Map<string, Assignment[]>(); staffing.assignments.forEach((a: Assignment) => { const key = a.date.slice(0, 7); if (!map.has(key)) map.set(key, []); map.get(key)!.push(a); }); return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])); }, [staffing.assignments]);
    if (selectedMonth) {
        const monthStr = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}`;
        const monthAssignments = staffing.assignments.filter((a: Assignment) => a.date.startsWith(monthStr));
        return (<div className="space-y-6"><button onClick={() => onSelect(null)} className="flex items-center text-xs font-bold text-blue-600 uppercase tracking-widest"><ChevronLeft className="w-4 h-4" /> Back</button><div className="technical-card overflow-hidden"><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Date</th><th className="col-header">Ward</th><th className="col-header">Staff</th></tr></thead><tbody className="text-sm divide-y divide-slate-100">{monthAssignments.map((a: Assignment) => (<tr key={a.id} className="hover:bg-slate-50/50"><td className="px-6 py-4 text-[10px] font-mono font-bold text-blue-600">{a.date}</td><td className="px-6 py-4 font-semibold text-slate-800">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1">{a.doctorIds.map(id => (<span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{staffing.doctorMap.get(id)?.name}</span>))}</div></td></tr>))}</tbody></table></div></div>);
    }
    return (<div className="space-y-6"><div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h2 className="text-xl font-bold text-slate-800">Archives</h2></div><div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">{months.map(([monthKey, assignments]) => { const [year, month] = monthKey.split('-').map(Number); const date = new Date(year, month - 1); return (<div key={monthKey} onClick={() => onSelect({ year, month: month - 1 })} className="technical-card p-6 cursor-pointer hover:border-blue-300 transition-all group"><div className="flex justify-between items-start mb-4"><div className="bg-blue-50 p-2 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Archive className="w-5 h-5" /></div><span className="text-[10px] font-bold text-slate-400 uppercase">{assignments.length} Records</span></div><h3 className="text-lg font-bold text-slate-800">{new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)}</h3><p className="text-xs font-mono text-slate-400">{year}</p></div>); })}</div></div>);
};

const AssignmentsView = React.memo(({ staffing }: { staffing: any }) => {
    return (<div className="space-y-6"><div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div><h2 className="text-xl font-bold text-slate-800">Logs</h2></div></div><div className="technical-card overflow-hidden"><table className="technical-grid"><thead><tr className="bg-slate-50/50"><th className="col-header">Timeline</th><th className="col-header">Ward</th><th className="col-header">Staff</th></tr></thead><tbody className="text-sm divide-y divide-slate-100">{staffing.assignments.slice().reverse().map((a: Assignment) => (<tr key={a.id} className="hover:bg-slate-50/50"><td className="px-6 py-4 text-[10px] font-mono text-blue-600 font-bold">{a.date}</td><td className="px-6 py-4 font-semibold text-slate-800">{staffing.wardMap.get(a.wardId)?.name}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1.5 font-mono text-[9px]">{a.doctorIds.map(id => (<span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">{staffing.doctorMap.get(id)?.name}</span>))}</div></td></tr>))}</tbody></table></div></div>);
});

function NavItem({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) { return (<div onClick={onClick} className={`sidebar-nav-item flex items-center space-x-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><div className={`${active ? 'text-white' : 'text-slate-500'}`}>{icon}</div><span className="text-sm font-medium">{label}</span></div>); }
function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) { return (<div className="bg-white border border-slate-200 rounded-xl p-6 flex items-start justify-between shadow-sm hover:shadow-md transition-shadow"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p><p className="text-3xl font-bold text-slate-900">{value}</p></div><div className="bg-blue-50 p-2.5 rounded-lg">{icon}</div></div>); }
