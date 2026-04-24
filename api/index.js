import express from 'express';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const SALT = 'wardstaffer_v1_salt';
const hashPassword = (pass) => {
    if (!pass) return null;
    // Check if already hashed (hex string of 128 chars for scrypt 64-byte)
    if (/^[0-9a-f]{128}$/.test(pass)) return pass;
    return crypto.scryptSync(pass, SALT, 64).toString('hex');
};

const app = express();
app.use(express.json());

// In-memory mock database for fallback
let mockDb = {
  doctors: [],
  wards: [],
  assignments: [],
  logs: []
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
    sql(`CREATE TABLE IF NOT EXISTS wards (id TEXT PRIMARY KEY, name TEXT NOT NULL, requirements TEXT NOT NULL, "parentWardId" TEXT)`),
    sql(`CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, period TEXT NOT NULL, "wardId" TEXT NOT NULL, "doctorIds" TEXT NOT NULL)`),
    sql(`CREATE TABLE IF NOT EXISTS shifts (id TEXT PRIMARY KEY, period TEXT NOT NULL, day INTEGER NOT NULL, "wardId" TEXT NOT NULL, "slotIndex" INTEGER NOT NULL, "doctorId" TEXT NOT NULL)`),
    sql(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
    sql(`CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL, period TEXT NOT NULL)`)
  ]);
  // Migrations: Ensure newer columns exist in existing tables
  try { await sql(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS password TEXT`); } catch(e){}
  try { await sql(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS period TEXT`); } catch(e){}
  try { await sql(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS period TEXT`); } catch(e){}
  try { await sql(`ALTER TABLE wards ADD COLUMN IF NOT EXISTS "parentWardId" TEXT`); } catch(e){}
  try { await sql(`ALTER TABLE wards ADD COLUMN IF NOT EXISTS "hiddenFromCalendar" BOOLEAN`); } catch(e){}
  try { await sql(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`); } catch(e){}
  // Clean up legacy columns that might cause NOT NULL violations
  try { await sql(`ALTER TABLE assignments ALTER COLUMN "date" DROP NOT NULL`); } catch(e){}
  try { await sql(`ALTER TABLE assignments DROP COLUMN IF EXISTS "date"`); } catch(e){}
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
        INSERT INTO wards (id, name, requirements, "parentWardId", "hiddenFromCalendar") 
        VALUES ($1, $2, $3, $4, $5) 
        ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name, 
            requirements = EXCLUDED.requirements,
            "parentWardId" = EXCLUDED."parentWardId",
            "hiddenFromCalendar" = EXCLUDED."hiddenFromCalendar"
    `, [w.id, w.name, JSON.stringify(w.requirements), w.parentWardId || null, w.hiddenFromCalendar ? true : false]);
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
    res.json(rows.map(r => {
        const { password, ...rest } = r;
        return { ...rest, previousWards: JSON.parse(r.previousWards) };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/doctors', async (req, res) => {
  await getTablesReady();
  const { id, name, gender, password, previousWards } = req.body;
  const doc = { 
      id, name, gender, 
      password: hashPassword(password || '11111111'), 
      previousWards: previousWards || [] 
  };
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
    await upsertDoctor({ 
        id: req.params.id, name, gender, 
        password: password ? hashPassword(password) : undefined, 
        previousWards 
    });
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

app.post('/api/login', async (req, res) => {
  await getTablesReady();
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Name and password required' });

  const cleanName = name.trim().toLowerCase();
  try {
    const sql = getSql();
    let doctor;

    if (isUsingMock) {
        doctor = mockDb.doctors.find(d => d.name.trim().toLowerCase() === cleanName);
    } else {
        const rows = await sql('SELECT * FROM doctors WHERE LOWER(name) = $1', [cleanName]);
        doctor = rows[0];
    }

    if (!doctor) return res.status(401).json({ error: 'Physician not found' });

    const hashedInput = hashPassword(password);
    if (doctor.password !== hashedInput) {
        // Migration: allow plain text login once and upgrade to hash
        if (doctor.password === password) {
            if (isUsingMock) {
                doctor.password = hashedInput;
            } else {
                await sql('UPDATE doctors SET password = $1 WHERE id = $2', [hashedInput, doctor.id]);
            }
        } else {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
    }

    const { password: _, ...user } = doctor;
    res.json({ ...user, role: doctor.id === 'root' ? 'admin' : 'resident' });
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
  const { id, name, requirements, parentWardId, hiddenFromCalendar } = req.body;
  if (isUsingMock) {
    mockDb.wards.push({ id, name, requirements, parentWardId, hiddenFromCalendar });
    return res.json({ success: true });
  }
  try {
    await upsertWard({ id, name, requirements, parentWardId, hiddenFromCalendar });
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/wards/:id', async (req, res) => {
  await getTablesReady();
  const { name, requirements, parentWardId, hiddenFromCalendar } = req.body;
  if (isUsingMock) {
    const idx = mockDb.wards.findIndex(w => w.id === req.params.id);
    if (idx > -1) mockDb.wards[idx] = { id: req.params.id, name, requirements, parentWardId, hiddenFromCalendar };
    return res.json({ success: true });
  }
  try {
    await upsertWard({ id: req.params.id, name, requirements, parentWardId, hiddenFromCalendar });
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
        ...(doctors || []).map(d => upsertDoctor({ ...d, password: d.password ? hashPassword(d.password) : undefined }))
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
  const { period, type } = req.body;
  if (isUsingMock) {
    if (period) {
        mockDb.shifts = (mockDb.shifts || []).filter(s => {
            if (s.period !== period) return true;
            if (type === 'er') return !s.wardId.startsWith('er-');
            if (type === 'ward') return s.wardId.startsWith('er-');
            return false;
        });
    } else mockDb.shifts = [];
    return res.json({ success: true });
  }
  try {
    const sql = getSql();
    if (period) {
        if (type === 'er') await sql("DELETE FROM shifts WHERE period = $1 AND \"wardId\" LIKE 'er-%'", [period]);
        else if (type === 'ward') await sql("DELETE FROM shifts WHERE period = $1 AND \"wardId\" NOT LIKE 'er-%'", [period]);
        else await sql('DELETE FROM shifts WHERE period = $1', [period]);
    } else await sql('DELETE FROM shifts');
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
    if (doctors) promises.push(...doctors.map(d => upsertDoctor({ ...d, password: d.password ? hashPassword(d.password) : undefined })));
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

app.get('/api/config', async (req, res) => {
    await getTablesReady();
    if (isUsingMock) return res.json({ men: [], women: [], pediatric: [] });
    try {
        const sql = getSql();
        const rows = await sql('SELECT value FROM settings WHERE key = $1', ['er_config']);
        res.json(rows[0]?.value ? JSON.parse(rows[0].value) : { men: [], women: [], pediatric: [] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config', async (req, res) => {
    await getTablesReady();
    if (isUsingMock) return res.json({ success: true });
    try {
        const sql = getSql();
        await sql('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['er_config', JSON.stringify(req.body)]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Audit Logs ---
app.get('/api/logs', async (req, res) => {
    await getTablesReady();
    if (isUsingMock) return res.json(mockDb.logs || []);
    try {
        const sql = getSql();
        const rows = await sql('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logs', async (req, res) => {
    await getTablesReady();
    const log = req.body;
    if (isUsingMock) {
        if (!mockDb.logs) mockDb.logs = [];
        mockDb.logs.unshift(log);
        return res.json({ success: true });
    }
    try {
        const sql = getSql();
        await sql('INSERT INTO logs (id, timestamp, action, details, period) VALUES ($1, $2, $3, $4, $5)', [log.id, log.timestamp, log.action, log.details, log.period]);
        res.status(201).json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default app;
