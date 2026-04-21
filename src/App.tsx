import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Hospital, 
  ClipboardList, 
  FileUp, 
  Plus, 
  Trash2, 
  Download,
  Calendar,
  ChevronRight,
  UserPlus,
  Edit2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStaffingData } from './hooks/useStaffingData';
import { Doctor, Ward, Gender, Assignment } from './types';
import * as XLSX from 'xlsx';

type View = 'dashboard' | 'doctors' | 'wards' | 'assignments';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const staffing = useStaffingData();

  const handleExport = () => {
    // Export Doctors
    const doctorsWs = XLSX.utils.json_to_sheet(staffing.doctors.map(d => ({
        ID: d.id,
        Name: d.name,
        Gender: d.gender,
        PreviousWards: d.previousWards.join(', ')
    })));
    
    // Export Wards
    const wardsWs = XLSX.utils.json_to_sheet(staffing.wards.map(w => ({
        ID: w.id,
        Name: w.name,
        'Total Doctors Required': w.requirements.totalDoctors,
        'Gender Diversity': w.requirements.genderDiversity,
        'Min Male': w.requirements.requiredMale || 0,
        'Min Female': w.requirements.requiredFemale || 0
    })));

    // Export Assignments
    const assignmentsWs = XLSX.utils.json_to_sheet(staffing.assignments.map(a => ({
        Date: a.date,
        Ward: staffing.wardMap.get(a.wardId)?.name || 'Unknown',
        Doctors: a.doctorIds.map(id => staffing.doctorMap.get(id)?.name || 'Unknown').join(', ')
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, doctorsWs, "Doctors");
    XLSX.utils.book_append_sheet(wb, wardsWs, "Wards");
    XLSX.utils.book_append_sheet(wb, assignmentsWs, "Assignments");
    
    XLSX.writeFile(wb, `Staffing_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            
            // Helper for fuzzy column matching
            const findKey = (row: any, patterns: string[]) => {
                const key = Object.keys(row).find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
                return key ? row[key] : null;
            };

            // 1. Process Doctors
            const docSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('doctor') || n.toLowerCase().includes('staff')) || wb.SheetNames[0];
            const docWs = wb.Sheets[docSheetName];
            let importedDoctors: Doctor[] = [];
            
            if (docWs) {
                const docData = XLSX.utils.sheet_to_json(docWs) as any[];
                importedDoctors = docData.map(d => {
                    const name = findKey(d, ['doctor name', 'full name', 'name', 'official', 'physician']) || "Unnamed Doctor";
                    const gender = findKey(d, ['gender', 'sex', 'profile']) || "Other";
                    const pw = findKey(d, ['previous wards', 'pw', 'experience', 'history', 'past']) || "";

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        name: name.toString().trim(),
                        gender: (gender.toString().trim() as Gender) || "Other",
                        previousWards: pw ? pw.toString().split(',').map((s: string) => s.trim()).filter(Boolean) : []
                    };
                });
            }

            // 2. Process Wards (if any)
            const wardSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('ward') || n.toLowerCase().includes('unit'));
            let importedWards: Ward[] = [];
            if (wardSheetName) {
                const wardWs = wb.Sheets[wardSheetName];
                const wardData = XLSX.utils.sheet_to_json(wardWs) as any[];
                importedWards = wardData.map(w => {
                    const name = findKey(w, ['ward name', 'unit name', 'name', 'designation']) || "Unnamed Ward";
                    const quota = parseInt(findKey(w, ['quota', 'total doctors', 'capacity', 'staff needed']) || '2');
                    const diversity = findKey(w, ['diversity', 'gender strategy', 'mode']) || 'None';

                    return {
                        id: `ward-${Math.random().toString(36).substr(2, 5)}`,
                        name: name.toString().trim(),
                        requirements: {
                            totalDoctors: isNaN(quota) ? 2 : quota,
                            genderDiversity: (diversity.toString().trim() as any) || 'None'
                        }
                    };
                });
            }

            staffing.importData({ 
                doctors: importedDoctors,
                ...(importedWards.length > 0 && { wards: importedWards })
            });
        } catch (err) {
            alert('Import Error: Ensure the Excel format is correct.');
            console.error(err);
        }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col h-full border-r border-slate-200 z-10 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">W</div>
            <span className="text-xl font-semibold tracking-tight">WardStaffer</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-2 font-bold">Health Systems Optimized</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} label="Overview" icon={<ClipboardList className="w-4 h-4" />} />
          <NavItem active={currentView === 'doctors'} onClick={() => setCurrentView('doctors')} label="Staff Registry" icon={<Users className="w-4 h-4" />} />
          <NavItem active={currentView === 'wards'} onClick={() => setCurrentView('wards')} label="Ward Config" icon={<Hospital className="w-4 h-4" />} />
          <NavItem active={currentView === 'assignments'} onClick={() => setCurrentView('assignments')} label="History Logs" icon={<Calendar className="w-4 h-4" />} />
        </nav>

        <div className="p-6 border-t border-slate-800 bg-slate-950/50">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-4 tracking-widest">Global Controls</div>
          <div className="space-y-3">
              <button onClick={handleExport} className="w-full flex items-center space-x-3 text-xs text-slate-400 hover:text-white transition-colors py-1">
                <Download className="w-3 h-3" /> <span>Export Dataset</span>
              </button>
              <label className="w-full flex items-center space-x-3 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer py-1">
                <FileUp className="w-3 h-3" /> <span>Import Excel</span>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} />
              </label>
              <div className="flex items-center space-x-2 text-[10px] text-slate-500 pt-3 mt-1 border-t border-slate-800">
                <div className={`w-2 h-2 rounded-full ${staffing.loading ? 'bg-amber-500' : 'bg-emerald-500'} ${staffing.loading && 'animate-pulse'}`}></div>
                <span>{staffing.loading ? 'Syncing Cloud...' : 'Database Connected'}</span>
              </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm shrink-0 z-20">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-semibold text-slate-800 capitalize">{currentView}</h1>
            <div className="h-4 w-[1px] bg-slate-200"></div>
            <div className="flex items-center text-[10px] text-slate-400 gap-1 uppercase font-bold tracking-wider">
              <span>System</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-blue-600">{currentView}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
             {staffing.syncing && (
                <div className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold animate-in fade-in zoom-in duration-300">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Background Syncing...</span>
                </div>
             )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {currentView === 'dashboard' && <DashboardView staffing={staffing} />}
                {currentView === 'doctors' && <DoctorsView staffing={staffing} />}
                {currentView === 'wards' && <WardsView staffing={staffing} />}
                {currentView === 'assignments' && <AssignmentsView staffing={staffing} />}
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
    <div 
      onClick={onClick}
      className={`sidebar-nav-item flex items-center space-x-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      <div className={`${active ? 'text-white' : 'text-slate-500'}`}>{icon}</div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

// --- VIEWS (Memoized for performance) ---

const DashboardView = React.memo(({ staffing }: { staffing: any }) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Active Personnel" value={staffing.doctors.length} icon={<Users className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Operating Wards" value={staffing.wards.length} icon={<Hospital className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Total Shifts" value={staffing.assignments.length} icon={<Calendar className="w-5 h-5 text-blue-600" />} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
            <div className="technical-card p-6 h-full">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" /> Dispatch Engine
                </h2>
                <p className="text-[11px] text-slate-500 mb-6 leading-relaxed font-medium">Automatic doctor assignment optimized for clinical history and diversity quotas.</p>
                
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Assignment Target Date</label>
                        <input type="date" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all" defaultValue={new Date().toISOString().split('T')[0]} id="gen-date" />
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                        <button 
                            disabled={staffing.syncing}
                            onClick={() => {
                                const dateInput = document.getElementById('gen-date') as HTMLInputElement;
                                staffing.generateAssignments(dateInput.value);
                            }}
                            className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
                        >
                            Execute Dispatch
                        </button>
                        <button 
                            onClick={() => { if(confirm('Purge all assignments?')) staffing.clearAssignments(); }}
                            className="text-[10px] text-slate-400 font-bold uppercase hover:text-red-500 transition-colors py-2 tracking-widest flex items-center justify-center gap-2"
                        >
                            <Trash2 className="w-3 h-3" /> Clear History
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
            <div className="technical-card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Real-time Deployment Log</h3>
                    <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Monitoring Feed</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="technical-grid">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="col-header">Timestamp</th>
                                <th className="col-header">Unit / Ward</th>
                                <th className="col-header">Assigned Personnel</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {staffing.assignments.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-xs italic">System awaiting initial dispatch command.</td>
                                </tr>
                            ) : (
                                staffing.assignments.slice(-8).reverse().map((a: Assignment) => (
                                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-[10px] font-mono text-slate-500">{a.date}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-700">{staffing.wardMap.get(a.wardId)?.name}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {a.doctorIds.map(id => (
                                                    <span key={id} className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase border border-blue-100">
                                                        {staffing.doctorMap.get(id)?.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
});

const DoctorsView = React.memo(({ staffing }: { staffing: any }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({ name: '', gender: 'Male', previousWards: [] });

  const handleAdd = () => {
      if (!newDoctor.name) return;
      
      const payload = {
          id: editingId || Math.random().toString(36).substr(2, 9),
          name: newDoctor.name.trim(),
          gender: newDoctor.gender as Gender,
          previousWards: newDoctor.previousWards || []
      };

      if (editingId) {
          staffing.updateDoctor(payload);
          setEditingId(null);
      } else {
          staffing.addDoctor(payload);
      }
      
      setShowAdd(false);
      setNewDoctor({ name: '', gender: 'Male', previousWards: [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Personnel Registry</h2>
            <p className="text-xs text-slate-500 mt-1">Operational database for medical staff management.</p>
        </div>
        <button className="btn-primary" onClick={() => {
            if (showAdd && editingId) {
                setEditingId(null);
                setNewDoctor({ name: '', gender: 'Male', previousWards: [] });
            }
            setShowAdd(!showAdd);
        }}>
            <UserPlus className="w-4 h-4" /> {showAdd ? 'Close Registry' : 'Register Member'}
        </button>
      </div>

      <AnimatePresence>
          {showAdd && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="technical-card p-8 bg-white mb-6 border-blue-100 ring-1 ring-blue-50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-slate-400">Full Name</label>
                              <input type="text" placeholder="Dr. Sarah Jones" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newDoctor.name} onChange={e => setNewDoctor(prev => ({ ...prev, name: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-slate-400">Gender Identity</label>
                              <select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newDoctor.gender} onChange={e => setNewDoctor(prev => ({ ...prev, gender: e.target.value as Gender }))}>
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                  <option value="Other">Other</option>
                                  <option value="Prefer not to say">Prefer not to say</option>
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-slate-400">Ward Exposure (IDs)</label>
                              <input 
                                type="text" 
                                placeholder="ER, ICU, NICU" 
                                className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" 
                                value={newDoctor.previousWards?.join(', ') || ''} 
                                onChange={e => setNewDoctor(prev => ({ ...prev, previousWards: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} 
                              />
                          </div>
                      </div>
                       <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                        <button className="btn-primary px-8" onClick={handleAdd}>{editingId ? 'Save Modifications' : 'Initialize Member'}</button>
                        <button className="btn-secondary" onClick={() => { setShowAdd(false); setEditingId(null); }}>Cancel</button>
                      </div>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <div className="technical-card overflow-hidden">
        <table className="technical-grid">
            <thead>
                <tr className="bg-slate-50/50">
                    <th className="col-header">Registry ID</th>
                    <th className="col-header">Full Member Name</th>
                    <th className="col-header">Gender Profile</th>
                    <th className="col-header text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
                {staffing.doctors.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-xs">Registry is currently empty. Use import or add member.</td>
                    </tr>
                ) : (
                    staffing.doctors.map((d: Doctor) => (
                        <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{d.id}</td>
                            <td className="px-6 py-4 font-semibold text-slate-800">{d.name}</td>
                            <td className="px-6 py-4 text-xs">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${d.gender === 'Male' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-pink-50 text-pink-600 border-pink-100'}`}>
                                    {d.gender}
                                </span>
                            </td>
                             <td className="px-6 py-4 text-right flex justify-end gap-2">
                                <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100" onClick={() => { setEditingId(d.id); setNewDoctor(d); setShowAdd(true); }}>
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100" onClick={() => { if(confirm('Delete member?')) staffing.deleteDoctor(d.id); }}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
});

const WardsView = React.memo(({ staffing }: { staffing: any }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newWard, setNewWard] = useState<Partial<Ward>>({ 
        name: '', 
        requirements: { totalDoctors: 2, genderDiversity: 'None' } 
    });

    const handleAdd = () => {
        if (!newWard.name) return;
        
        const wardData = {
            id: editingId || `ward-${Math.random().toString(36).substr(2, 5)}`,
            name: newWard.name.trim(),
            requirements: {
                totalDoctors: newWard.requirements?.totalDoctors || 2,
                genderDiversity: newWard.requirements?.genderDiversity || 'None',
                requiredMale: newWard.requirements?.requiredMale,
                requiredFemale: newWard.requirements?.requiredFemale
            }
        };

        if (editingId) staffing.updateWard(wardData);
        else staffing.addWard(wardData);

        setShowAdd(false);
        setEditingId(null);
        setNewWard({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None' } });
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">Unit Specialization</h2>
              <p className="text-xs text-slate-500 mt-1">Configure clinical units and precision staffing metrics.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="w-4 h-4" /> {showAdd ? 'Close Config' : 'Initialize Ward'}
          </button>
        </div>

        <AnimatePresence>
            {showAdd && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="technical-card p-8 space-y-6 bg-white mb-6 border-blue-100 ring-1 ring-blue-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400">Designation</label>
                                <input type="text" placeholder="e.g. Intensive Care Unit" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.name} onChange={e => setNewWard(prev => ({ ...prev, name: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400">Staff Quota</label>
                                <input type="number" min="1" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.totalDoctors} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, totalDoctors: parseInt(e.target.value) } }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400">Diversity Strategy</label>
                                <select className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.genderDiversity} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, genderDiversity: e.target.value as any } }))}>
                                    <option value="None">No Requirement</option>
                                    <option value="Balance">Balanced Optimization</option>
                                    <option value="Specific">Quantified Minimums</option>
                                </select>
                            </div>
                            {newWard.requirements?.genderDiversity === 'Specific' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Min. Male</label>
                                        <input type="number" min="0" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.requiredMale} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, requiredMale: parseInt(e.target.value) } }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Min. Female</label>
                                        <input type="number" min="0" className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg" value={newWard.requirements?.requiredFemale} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, requiredFemale: parseInt(e.target.value) } }))} />
                                    </div>
                                </>
                            )}
                        </div>
                         <div className="flex gap-3 pt-6 border-t border-slate-100">
                          <button className="btn-primary px-8" onClick={handleAdd}>{editingId ? 'Update Config' : 'Deploy Ward'}</button>
                          <button className="btn-secondary" onClick={() => { setShowAdd(false); setEditingId(null); }}>Abort</button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="technical-card overflow-hidden">
          <table className="technical-grid">
              <thead>
                  <tr className="bg-slate-50/50">
                      <th className="col-header">Unit ID</th>
                      <th className="col-header">Official Name</th>
                      <th className="col-header">Capacity Metrics</th>
                      <th className="col-header text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                  {staffing.wards.length === 0 ? (
                      <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-xs">No active units defined.</td>
                      </tr>
                  ) : (
                      staffing.wards.map((w: Ward) => (
                          <tr key={w.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">{w.id}</td>
                              <td className="px-6 py-4 font-semibold text-slate-800">{w.name}</td>
                              <td className="px-6 py-4">
                                  <div className="flex items-center space-x-2">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{w.requirements.totalDoctors} Personnel</span>
                                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200 uppercase tracking-tight">{w.requirements.genderDiversity}</span>
                                  </div>
                              </td>
                               <td className="px-6 py-4 text-right flex justify-end gap-2">
                                  <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100" onClick={() => { setEditingId(w.id); setNewWard(w); setShowAdd(true); }}>
                                      <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button className="p-1.5 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100" onClick={() => { if(confirm('Remove ward?')) staffing.deleteWard(w.id); }}>
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </td>
                          </tr>
                      ))
                  )}
              </tbody>
          </table>
        </div>
      </div>
    );
});

const AssignmentsView = React.memo(({ staffing }: { staffing: any }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">Deployment Archives</h2>
                    <p className="text-xs text-slate-500 mt-1">Audit trail of historical ward dispatches.</p>
                </div>
                <button className="btn-secondary text-red-500 hover:bg-red-50 border-red-100" onClick={() => { if(confirm('Clear all logs?')) staffing.clearAssignments(); }}>
                    <Trash2 className="w-4 h-4" /> Purge Logs
                </button>
            </div>

            <div className="technical-card overflow-hidden">
                <table className="technical-grid">
                    <thead>
                        <tr className="bg-slate-50/50">
                            <th className="col-header">Timeline</th>
                            <th className="col-header">Target Unit</th>
                            <th className="col-header">Deployed Personnel</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                        {staffing.assignments.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic text-xs">No records found. Generate assignments to begin.</td>
                            </tr>
                        ) : (
                            staffing.assignments.slice().reverse().map((a: Assignment) => (
                                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-[10px] font-mono text-blue-600 font-bold">{a.date}</td>
                                    <td className="px-6 py-4 font-semibold text-slate-800">{staffing.wardMap.get(a.wardId)?.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                                            {a.doctorIds.map(id => (
                                                <span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">
                                                    {staffing.doctorMap.get(id)?.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-start justify-between shadow-sm hover:shadow-md transition-shadow">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
        <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
      <div className="bg-blue-50 p-2.5 rounded-lg">
        {icon}
      </div>
    </div>
  );
}
