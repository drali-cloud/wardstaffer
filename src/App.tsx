import React, { useState } from 'react';
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
  Edit2
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
        Ward: staffing.wards.find(w => w.id === a.wardId)?.name || 'Unknown',
        Doctors: a.doctorIds.map(id => staffing.doctors.find(d => d.id === id)?.name || 'Unknown').join(', ')
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, doctorsWs, "Doctors");
    XLSX.utils.book_append_sheet(wb, wardsWs, "Wards");
    XLSX.utils.book_append_sheet(wb, assignmentsWs, "Assignments");
    
    XLSX.writeFile(wb, "Hospital_Staffing_Data.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        // Find the sheet: either "Doctors" or the first available sheet
        const sheetName = wb.SheetNames.includes("Doctors") ? "Doctors" : wb.SheetNames[0];
        const docWs = wb.Sheets[sheetName];

        if (docWs) {
            const docData = XLSX.utils.sheet_to_json(docWs) as any[];
            const importedDoctors: Doctor[] = docData.map(d => {
                // Find column values by looking for various keys (case-insensitive)
                const findKey = (patterns: string[]) => {
                    const key = Object.keys(d).find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
                    return key ? d[key] : null;
                };

                const name = findKey(['doctor name', 'name', 'official title']) || "Unnamed Doctor";
                const gender = findKey(['gender of the doctor', 'gender']) || "Other";
                const pw = findKey(['previous wards', 'pw', 'experience']) || "";

                return {
                    id: Math.random().toString(36).substr(2, 9),
                    name: name.toString(),
                    gender: gender.toString() as Gender,
                    previousWards: pw ? pw.toString().split(',').map((s: string) => s.trim()).filter(Boolean) : []
                };
            });
            staffing.importData({ doctors: importedDoctors });
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
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-2 font-bold">Health Systems v1.0</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            label="Overview"
          />
          <NavItem 
            active={currentView === 'doctors'} 
            onClick={() => setCurrentView('doctors')}
            label="Staff Registry"
          />
          <NavItem 
            active={currentView === 'wards'} 
            onClick={() => setCurrentView('wards')}
            label="Ward Config"
          />
          <NavItem 
            active={currentView === 'assignments'} 
            onClick={() => setCurrentView('assignments')}
            label="History Logs"
          />
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-4 tracking-widest">Reports & Controls</div>
          <div className="space-y-3">
              <button 
                onClick={handleExport}
                className="w-full flex items-center space-x-3 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <Download className="w-3 h-3" /> <span>Export Dataset</span>
              </button>
              <label className="w-full flex items-center space-x-3 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
                <FileUp className="w-3 h-3" /> <span>Import Excel</span>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} />
              </label>
              <div className="flex items-center space-x-2 text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>Database Local-Sync</span>
              </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm shrink-0 z-20">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-semibold text-slate-800 capitalize">{currentView === 'dashboard' ? 'Health System Overview' : currentView}</h1>
            <div className="h-4 w-[1px] bg-slate-200"></div>
            <div className="flex items-center text-[10px] text-slate-400 gap-1 uppercase font-bold tracking-wider">
              <span>Root</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-blue-600">{currentView}</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
             {/* Header actions if needed */}
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
                transition={{ duration: 0.2 }}
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

function NavItem({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <div 
      onClick={onClick}
      className={`sidebar-nav-item ${active ? 'sidebar-nav-item-active' : 'sidebar-nav-item-inactive'}`}
    >
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-400' : 'bg-slate-600'}`}></div>
      <span>{label}</span>
    </div>
  );
}

// --- VIEWS ---

function DashboardView({ staffing }: { staffing: any }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Active Personnel" value={staffing.doctors.length} icon={<Users className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Operating Wards" value={staffing.wards.length} icon={<Hospital className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Total Shifts" value={staffing.assignments.length} icon={<Calendar className="w-5 h-5 text-blue-600" />} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="technical-card p-6">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" /> Dispatch Generator
                </h2>
                <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">System-automated doctor assignment based on relational history and diversity constraints.</p>
                
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label>Assignment Date</label>
                        <input type="date" className="w-full" defaultValue={new Date().toISOString().split('T')[0]} id="gen-date" />
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                        <button 
                            onClick={() => {
                                const dateInput = document.getElementById('gen-date') as HTMLInputElement;
                                staffing.generateAssignments(dateInput.value);
                            }}
                            className="btn-primary w-full justify-center py-2.5"
                        >
                            Execute Dispatch
                        </button>
                        <button 
                            onClick={() => staffing.clearAssignments()}
                            className="text-[10px] text-slate-400 font-bold uppercase hover:text-red-500 transition-colors py-2 tracking-widest"
                        >
                            Purge Records
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
            <div className="technical-card">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Real-time Dispatch Log</h3>
                    <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active System</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="technical-grid">
                        <thead>
                            <tr>
                                <th className="col-header">Timestamp</th>
                                <th className="col-header">Unit / Ward</th>
                                <th className="col-header">Assigned Personnel</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {staffing.assignments.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-xs italic">No activity logged in current session.</td>
                                </tr>
                            ) : (
                                staffing.assignments.slice(-10).reverse().map((a: Assignment) => (
                                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-[10px] font-mono text-slate-500">{a.date}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-700">{staffing.wards.find((w: Ward) => w.id === a.wardId)?.name}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {a.doctorIds.map(id => (
                                                    <span key={id} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-tight">
                                                        {staffing.doctors.find((d: Doctor) => d.id === id)?.name}
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
}

function DoctorsView({ staffing }: { staffing: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({ name: '', gender: 'Male', previousWards: [] });

  const handleAdd = () => {
      if (!newDoctor.name) return;
      
      if (editingId) {
          staffing.updateDoctor({
              id: editingId,
              name: newDoctor.name,
              gender: newDoctor.gender as Gender,
              previousWards: newDoctor.previousWards || []
          });
          setEditingId(null);
      } else {
          staffing.addDoctor({
              id: Math.random().toString(36).substr(2, 9),
              name: newDoctor.name,
              gender: newDoctor.gender as Gender,
              previousWards: newDoctor.previousWards || []
          });
      }
      
      setShowAdd(false);
      setNewDoctor({ name: '', gender: 'Male', previousWards: [] });
  };

  const startEdit = (doctor: Doctor) => {
      setEditingId(doctor.id);
      setNewDoctor(doctor);
      setShowAdd(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Personnel Registry</h2>
            <p className="text-xs text-slate-500 mt-1">Comprehensive database of credentialed medical staff.</p>
        </div>
        <button className="btn-primary" onClick={() => {
            if (showAdd && editingId) {
                setEditingId(null);
                setNewDoctor({ name: '', gender: 'Male', previousWards: [] });
            }
            setShowAdd(!showAdd);
        }}>
            <UserPlus className="w-4 h-4" /> {showAdd ? 'Collapse Portal' : 'Register Physician'}
        </button>
      </div>

      <AnimatePresence>
          {showAdd && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }} 
                className="overflow-hidden"
              >
                  <div className="technical-card p-8 bg-white mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1">
                              <label>Identification Name</label>
                              <input type="text" placeholder="Dr. Sarah Jones" className="w-full" value={newDoctor.name} onChange={e => setNewDoctor(prev => ({ ...prev, name: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                              <label>Gender Profile</label>
                              <select className="w-full" value={newDoctor.gender} onChange={e => setNewDoctor(prev => ({ ...prev, gender: e.target.value as Gender }))}>
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                  <option value="Other">Other</option>
                                  <option value="Prefer not to say">Prefer not to say</option>
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label>Experience Matrix (Ward IDs)</label>
                              <input 
                                type="text" 
                                placeholder="ER, Oncology, etc" 
                                className="w-full" 
                                value={newDoctor.previousWards?.join(', ') || ''} 
                                onChange={e => setNewDoctor(prev => ({ ...prev, previousWards: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} 
                              />
                          </div>
                      </div>
                       <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                        <button className="btn-primary px-8" onClick={handleAdd}>{editingId ? 'Update Entry' : 'Confirm Entry'}</button>
                        <button className="btn-secondary" onClick={() => {
                            setShowAdd(false);
                            setEditingId(null);
                            setNewDoctor({ name: '', gender: 'Male', previousWards: [] });
                        }}>Discard</button>
                      </div>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <div className="technical-card">
        <table className="technical-grid">
            <thead>
                <tr>
                    <th className="col-header">Registry ID</th>
                    <th className="col-header">Official Title / Name</th>
                    <th className="col-header">Gender Profile</th>
                    <th className="col-header text-right">Administrative Action</th>
                </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
                {staffing.doctors.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-xs">No personnel registered in system database.</td>
                    </tr>
                ) : (
                    staffing.doctors.map((d: Doctor) => (
                        <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 text-[10px] font-mono text-slate-400 group-hover:text-blue-500 transition-colors uppercase">{d.id}</td>
                            <td className="px-6 py-4 font-semibold text-slate-800">{d.name}</td>
                            <td className="px-6 py-4 text-xs">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${d.gender === 'Male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                    {d.gender}
                                </span>
                            </td>
                             <td className="px-6 py-4 text-right flex justify-end gap-2">
                                <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100" onClick={() => startEdit(d)}>
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button className="btn-danger opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => staffing.deleteDoctor(d.id)}>
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
}

function WardsView({ staffing }: { staffing: any }) {
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
            name: newWard.name,
            requirements: {
                totalDoctors: newWard.requirements?.totalDoctors || 2,
                genderDiversity: newWard.requirements?.genderDiversity || 'None',
                requiredMale: newWard.requirements?.requiredMale,
                requiredFemale: newWard.requirements?.requiredFemale
            }
        };

        if (editingId) {
            staffing.updateWard(wardData);
            setEditingId(null);
        } else {
            staffing.addWard(wardData);
        }

        setShowAdd(false);
        setNewWard({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None' } });
    };

    const startEdit = (ward: Ward) => {
        setEditingId(ward.id);
        setNewWard(ward);
        setShowAdd(true);
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">Unit Specialization</h2>
              <p className="text-xs text-slate-500 mt-1">Configure clinical units and precision staffing metrics.</p>
          </div>
          <button className="btn-primary" onClick={() => {
              if (showAdd && editingId) {
                  setEditingId(null);
                  setNewWard({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None' } });
              }
              setShowAdd(!showAdd);
          }}>
              <Plus className="w-4 h-4" /> {showAdd ? 'Close Builder' : 'Initialize Ward'}
          </button>
        </div>

        <AnimatePresence>
            {showAdd && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="technical-card p-8 space-y-6 bg-white mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label>Ward Designation</label>
                                <input type="text" placeholder="e.g. Intensive Care Unit" className="w-full" value={newWard.name} onChange={e => setNewWard(prev => ({ ...prev, name: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <label>Personnel Quota</label>
                                <input type="number" min="1" className="w-full" value={newWard.requirements?.totalDoctors} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, totalDoctors: parseInt(e.target.value) } }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label>Diversity Strategy</label>
                                <select className="w-full" value={newWard.requirements?.genderDiversity} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, genderDiversity: e.target.value as any } }))}>
                                    <option value="None">No Requirement</option>
                                    <option value="Balance">Balanced Optimization</option>
                                    <option value="Specific">Quantified Minimums</option>
                                </select>
                            </div>
                            {newWard.requirements?.genderDiversity === 'Specific' && (
                                <>
                                    <div className="space-y-1">
                                        <label>Min. Male Capacity</label>
                                        <input type="number" min="0" className="w-full" value={newWard.requirements?.requiredMale} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, requiredMale: parseInt(e.target.value) } }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <label>Min. Female Capacity</label>
                                        <input type="number" min="0" className="w-full" value={newWard.requirements?.requiredFemale} onChange={e => setNewWard(prev => ({ ...prev, requirements: { ...prev.requirements!, requiredFemale: parseInt(e.target.value) } }))} />
                                    </div>
                                </>
                            )}
                        </div>
                         <div className="flex gap-3 pt-6 border-t border-slate-100 text-xs">
                          <button className="btn-primary" onClick={handleAdd}>{editingId ? 'Update Metrics' : 'Operationalize Ward'}</button>
                          <button className="btn-secondary" onClick={() => {
                              setShowAdd(false);
                              setEditingId(null);
                              setNewWard({ name: '', requirements: { totalDoctors: 2, genderDiversity: 'None' } });
                          }}>Abort</button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="technical-card">
          <table className="technical-grid">
              <thead>
                  <tr>
                      <th className="col-header">Unit ID</th>
                      <th className="col-header">Official Name</th>
                      <th className="col-header">Capacity Metrics</th>
                      <th className="col-header text-right">Status / Control</th>
                  </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                  {staffing.wards.length === 0 ? (
                      <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-xs">No active wards identified in clinical database.</td>
                      </tr>
                  ) : (
                      staffing.wards.map((w: Ward) => (
                          <tr key={w.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-4 text-[10px] font-mono text-slate-400 group-hover:text-blue-500 uppercase">{w.id}</td>
                              <td className="px-6 py-4 font-semibold text-slate-800">{w.name}</td>
                              <td className="px-6 py-4">
                                  <div className="flex items-center space-x-2">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{w.requirements.totalDoctors} Staff</span>
                                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">{w.requirements.genderDiversity}</span>
                                  </div>
                              </td>
                               <td className="px-6 py-4 text-right flex justify-end gap-2">
                                  <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100" onClick={() => startEdit(w)}>
                                      <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button className="btn-danger opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => staffing.deleteWard(w.id)}>
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
}

function AssignmentsView({ staffing }: { staffing: any }) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">Deployment Archives</h2>
                    <p className="text-xs text-slate-500 mt-1">Full audit trail of historical ward dispatches.</p>
                </div>
                <button className="btn-secondary" onClick={() => staffing.clearAssignments()}>
                    <Trash2 className="w-4 h-4" /> Purge Dispatch Logs
                </button>
            </div>

            <div className="technical-card">
                <table className="technical-grid overflow-hidden">
                    <thead>
                        <tr>
                            <th className="col-header">Timeline / Date</th>
                            <th className="col-header">Unit / Ward</th>
                            <th className="col-header">Deployment Personnel</th>
                            <th className="col-header text-right">Ref#</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                        {staffing.assignments.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-xs">Archives are currently empty. Initial dispatches required.</td>
                            </tr>
                        ) : (
                            staffing.assignments.map((a: Assignment, idx: number) => (
                                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-[10px] font-mono text-blue-600 font-bold">{a.date}</td>
                                    <td className="px-6 py-4 font-semibold text-slate-800">{staffing.wards.find((w: Ward) => w.id === a.wardId)?.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                                            {a.doctorIds.map(id => (
                                                <span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold">
                                                    {staffing.doctors.find((d: Doctor) => d.id === id)?.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-[10px] text-slate-300 font-mono">
                                        {idx + 1}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

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
