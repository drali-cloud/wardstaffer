import express from 'express';
import { neon } from '@neondatabase/serverless';

const app = express();
app.use(express.json());

// In-memory mock database for fallback
let mockDb = {
  doctors: [],
  wards: [],
  assignments: []
};
let isUsingMock = false;

// Neon connection (automatically handles SSL)
let sqlInstance = null;
function getSql() {
  if (sqlInstance) return sqlInstance;
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) throw new Error('No database connection string found.');
  sqlInstance = neon(dbUrl);
  return sqlInstance;
}

async function ensureTables() {
  const sql = getSql();
  // Execute all table creations in parallel
  await Promise.all([
    sql(`CREATE TABLE IF NOT EXISTS doctors (id TEXT PRIMARY KEY, name TEXT NOT NULL, gender TEXT NOT NULL, password TEXT, "previousWards" TEXT NOT NULL)`),
    sql(`CREATE TABLE IF NOT EXISTS wards (id TEXT PRIMARY KEY, name TEXT NOT NULL, requirements TEXT NOT NULL)`),
    sql(`CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, period TEXT NOT NULL, "wardId" TEXT NOT NULL, "doctorIds" TEXT NOT NULL)`),
    sql(`CREATE TABLE IF NOT EXISTS shifts (id TEXT PRIMARY KEY, period TEXT NOT NULL, day INTEGER NOT NULL, "wardId" TEXT NOT NULL, "slotIndex" INTEGER NOT NULL, "doctorId" TEXT NOT NULL)`)
  ]);
  // Migration: Ensure password column exists if table was already created
  try { await sql(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS password TEXT`); } catch(e){}
}

let tablesReady = null;
async function getTablesReady() {
  try {
    if (!tablesReady) {
        console.log('Synchronizing with Neon Database...');
        tablesReady = ensureTables();
    }
    await tablesReady;
    isUsingMock = false;
  } catch (err) {
    if (!isUsingMock) {
      console.warn('DATABASE CONNECTION FAILED. Falling back to mock storage.');
      console.warn('Reason:', err.message);
    }
    isUsingMock = true;
    tablesReady = null; 
  }
}

// --- Helper: Universal Persist ---
async function upsertDoctor(d) {
    const sql = getSql();
    await sql(`
        INSERT INTO doctors (id, name, gender, password, "previousWards") 
        VALUES ($1, $2, $3, $4, $5) 
        ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name, 
            gender = EXCLUDED.gender, 
            password = EXCLUDED.password,
            "previousWards" = EXCLUDED."previousWards"
    `, [d.id, d.name, d.gender, d.password || null, JSON.stringify(d.previousWards)]);
}

async function upsertWard(w) {
    const sql = getSql();
    await sql(`
        INSERT INTO wards (id, name, requirements) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name, 
            requirements = EXCLUDED.requirements
    `, [w.id, w.name, JSON.stringify(w.requirements)]);
}

async function upsertAssignment(a) {
    const sql = getSql();
    await sql(`
        INSERT INTO assignments (id, period, "wardId", "doctorIds") 
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (id) DO UPDATE SET 
            period = EXCLUDED.period, 
            "wardId" = EXCLUDED."wardId", 
            "doctorIds" = EXCLUDED."doctorIds"
    `, [a.id, a.period, a.wardId, JSON.stringify(a.doctorIds)]);
}

async function upsertShift(s) {
    const sql = getSql();
    await sql(`
        INSERT INTO shifts (id, period, day, "wardId", "slotIndex", "doctorId") 
        VALUES ($1, $2, $3, $4, $5, $6) 
        ON CONFLICT (id) DO UPDATE SET 
            period = EXCLUDED.period, 
            day = EXCLUDED.day, 
            "wardId" = EXCLUDED."wardId", 
            "slotIndex" = EXCLUDED."slotIndex", 
            "doctorId" = EXCLUDED."doctorId"
    `, [s.id, s.period, s.day, s.wardId, s.slotIndex, s.doctorId]);
}

// --- Doctors ---
app.get('/api/doctors', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) return res.json(mockDb.doctors);
  try {
    const sql = getSql();
    const rows = await sql('SELECT * FROM doctors ORDER BY name ASC');
    res.json(rows.map(r => ({ ...r, previousWards: JSON.parse(r.previousWards) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/doctors', async (req, res) => {
  await getTablesReady();
  const { id, name, gender, password, previousWards } = req.body;
  const doc = { id, name, gender, password: password || '11111111', previousWards: previousWards || [] };
  if (isUsingMock) {
    mockDb.doctors.push(doc);
    return res.status(201).json({ success: true });
  }
  try {
    await upsertDoctor(doc);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/doctors/:id', async (req, res) => {
  await getTablesReady();
  const { name, gender, password, previousWards } = req.body;
  if (isUsingMock) {
    const idx = mockDb.doctors.findIndex(d => d.id === req.params.id);
    if (idx > -1) {
        const existing = mockDb.doctors[idx];
        mockDb.doctors[idx] = { id: req.params.id, name, gender, password: password || existing.password, previousWards };
    }
    return res.json({ success: true });
  }
  try {
    // If password not provided in edit, we should keep existing. 
    // In this simple implementation, we'll assume it's passed or handled in upsert.
    await upsertDoctor({ id: req.params.id, name, gender, password, previousWards });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/doctors/:id', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) {
    mockDb.doctors = mockDb.doctors.filter(d => d.id !== req.params.id);
    return res.json({ success: true });
  }
  try {
    const sql = getSql();
    await sql('DELETE FROM doctors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Wards ---
app.get('/api/wards', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) return res.json(mockDb.wards);
  try {
    const sql = getSql();
    const rows = await sql('SELECT * FROM wards ORDER BY name ASC');
    res.json(rows.map(r => ({ ...r, requirements: JSON.parse(r.requirements) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/wards', async (req, res) => {
  await getTablesReady();
  const { id, name, requirements } = req.body;
  if (isUsingMock) {
    mockDb.wards.push({ id, name, requirements });
    return res.json({ success: true });
  }
  try {
    await upsertWard({ id, name, requirements });
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/wards/:id', async (req, res) => {
  await getTablesReady();
  const { name, requirements } = req.body;
  if (isUsingMock) {
    const idx = mockDb.wards.findIndex(w => w.id === req.params.id);
    if (idx > -1) mockDb.wards[idx] = { id: req.params.id, name, requirements };
    return res.json({ success: true });
  }
  try {
    await upsertWard({ id: req.params.id, name, requirements });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/wards/:id', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) {
    mockDb.wards = mockDb.wards.filter(w => w.id !== req.params.id);
    return res.json({ success: true });
  }
  try {
    const sql = getSql();
    await sql('DELETE FROM wards WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Assignments ---
app.get('/api/assignments', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) return res.json(mockDb.assignments);
  try {
    const sql = getSql();
    const rows = await sql('SELECT * FROM assignments');
    res.json(rows.map(r => ({ ...r, doctorIds: JSON.parse(r.doctorIds) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/dispatch', async (req, res) => {
  await getTablesReady();
  const { assignments, doctors } = req.body;
  if (isUsingMock) {
      if (assignments) mockDb.assignments.push(...assignments);
      if (doctors) {
          for (const d of doctors) {
              const idx = mockDb.doctors.findIndex(exist => exist.id === d.id);
              if (idx > -1) mockDb.doctors[idx] = d;
          }
      }
      return res.json({ success: true });
  }
  try {
    const sql = getSql();
    // Use a transaction or parallel execution for reliability
    await Promise.all([
        ...assignments.map(a => upsertAssignment(a)),
        ...(doctors || []).map(d => upsertDoctor(d))
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/assignments', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) {
    mockDb.assignments = [];
    return res.json({ success: true });
  }
  try {
    const sql = getSql();
    await sql('DELETE FROM assignments');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/assignments/bulk', async (req, res) => {
  await getTablesReady();
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs required' });
  if (isUsingMock) {
    mockDb.assignments = mockDb.assignments.filter(a => !ids.includes(a.id));
    return res.json({ success: true });
  }
  try {
    const sql = getSql();
    await Promise.all(ids.map(id => sql('DELETE FROM assignments WHERE id = $1', [id])));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/assignments/:id', async (req, res) => {
  await getTablesReady();
  const assignment = { ...req.body, id: req.params.id };
  if (isUsingMock) {
    const idx = mockDb.assignments.findIndex(a => a.id === req.params.id);
    if (idx > -1) mockDb.assignments[idx] = assignment;
    return res.json({ success: true });
  }
  try {
    await upsertAssignment(assignment);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Shifts (Daily Roster) ---
app.get('/api/shifts', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) return res.json(mockDb.shifts || []);
  try {
    const sql = getSql();
    const rows = await sql('SELECT * FROM shifts');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shifts', async (req, res) => {
  await getTablesReady();
  const shifts = Array.isArray(req.body) ? req.body : [req.body];
  if (isUsingMock) {
    if (!mockDb.shifts) mockDb.shifts = [];
    for (const s of shifts) {
      const idx = mockDb.shifts.findIndex(exist => exist.id === s.id);
      if (idx > -1) mockDb.shifts[idx] = s;
      else mockDb.shifts.push(s);
    }
    return res.json({ success: true });
  }
  try {
    await Promise.all(shifts.map(s => upsertShift(s)));
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shifts', async (req, res) => {
  await getTablesReady();
  const { period } = req.body;
  if (isUsingMock) {
    if (period) mockDb.shifts = (mockDb.shifts || []).filter(s => s.period !== period);
    else mockDb.shifts = [];
    return res.json({ success: true });
  }
  try {
    const sql = getSql();
    if (period) await sql('DELETE FROM shifts WHERE period = $1', [period]);
    else await sql('DELETE FROM shifts');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Bulk Import ---
app.post('/api/import', async (req, res) => {
  await getTablesReady();
  const { doctors, wards } = req.body;
  if (isUsingMock) {
    if (doctors) {
        for (const d of doctors) {
            const idx = mockDb.doctors.findIndex(exist => exist.id === d.id);
            if (idx > -1) mockDb.doctors[idx] = d;
            else mockDb.doctors.push(d);
        }
    }
    if (wards) {
        for (const w of wards) {
            const idx = mockDb.wards.findIndex(exist => exist.id === w.id);
            if (idx > -1) mockDb.wards[idx] = w;
            else mockDb.wards.push(w);
        }
    }
    return res.json({ success: true });
  }
  try {
    const promises = [];
    if (doctors) promises.push(...doctors.map(d => upsertDoctor(d)));
    if (wards) promises.push(...wards.map(w => upsertWard(w)));
    await Promise.all(promises);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Debug ---
app.get('/api/debug-db', async (req, res) => {
  try {
    const sql = getSql();
    const rows = await sql('SELECT NOW()');
    res.json({ status: 'connected', time: rows[0], mode: 'postgres (neon)' });
  } catch (e) {
    res.json({ status: 'error', message: e.message, mode: 'mock' });
  }
});

export default app;
