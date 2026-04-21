import express from 'express';
import { createPool } from '@vercel/postgres';

const app = express();
app.use(express.json());

// In-memory mock database for fallback
let mockDb = {
  doctors: [],
  wards: [],
  assignments: []
};
let isUsingMock = false;

const pool = createPool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});

async function ensureTables() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('No database connection string found.');
  }
  await pool.query('SELECT 1'); // Test connection
  
  await pool.query(`CREATE TABLE IF NOT EXISTS doctors (id TEXT PRIMARY KEY, name TEXT NOT NULL, gender TEXT NOT NULL, "previousWards" TEXT NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS wards (id TEXT PRIMARY KEY, name TEXT NOT NULL, requirements TEXT NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, date TEXT NOT NULL, "wardId" TEXT NOT NULL, "doctorIds" TEXT NOT NULL)`);
}

let tablesReady = null;
async function getTablesReady() {
  try {
    if (!tablesReady) tablesReady = ensureTables();
    await tablesReady;
    isUsingMock = false;
  } catch (err) {
    if (!isUsingMock) {
      console.warn('DATABASE CONNECTION FAILED. Falling back to in-memory storage. Changes will be lost on restart.');
      console.warn('Reason:', err.message);
    }
    isUsingMock = true;
    tablesReady = null; 
  }
}

// --- Doctors ---
app.get('/api/doctors', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) return res.json(mockDb.doctors);
  try {
    const { rows } = await pool.query('SELECT * FROM doctors ORDER BY name ASC');
    res.json(rows.map(r => ({ ...r, previousWards: JSON.parse(r.previousWards) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/doctors', async (req, res) => {
  await getTablesReady();
  const { id, name, gender, previousWards } = req.body;
  if (isUsingMock) {
    mockDb.doctors.push({ id, name, gender, previousWards });
    return res.json({ success: true, warning: 'Using mock storage' });
  }
  try {
    await pool.query('INSERT INTO doctors (id, name, gender, "previousWards") VALUES ($1, $2, $3, $4)', [id, name, gender, JSON.stringify(previousWards)]);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/doctors/:id', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) {
    mockDb.doctors = mockDb.doctors.filter(d => d.id !== req.params.id);
    return res.json({ success: true });
  }
  try {
    await pool.query('DELETE FROM doctors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Wards ---
app.get('/api/wards', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) return res.json(mockDb.wards);
  try {
    const { rows } = await pool.query('SELECT * FROM wards');
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
    await pool.query('INSERT INTO wards (id, name, requirements) VALUES ($1, $2, $3)', [id, name, JSON.stringify(requirements)]);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Assignments ---
app.get('/api/assignments', async (req, res) => {
  await getTablesReady();
  if (isUsingMock) return res.json(mockDb.assignments);
  try {
    const { rows } = await pool.query('SELECT * FROM assignments');
    res.json(rows.map(r => ({ ...r, doctorIds: JSON.parse(r.doctorIds) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/assignments', async (req, res) => {
  await getTablesReady();
  const assignments = Array.isArray(req.body) ? req.body : [req.body];
  if (isUsingMock) {
    for (const a of assignments) {
      const idx = mockDb.assignments.findIndex(exist => exist.id === a.id);
      if (idx > -1) mockDb.assignments[idx] = a;
      else mockDb.assignments.push(a);
    }
    return res.json({ success: true });
  }
  try {
    for (const a of assignments) {
      await pool.query(`INSERT INTO assignments (id, date, "wardId", "doctorIds") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, "wardId" = EXCLUDED."wardId", "doctorIds" = EXCLUDED."doctorIds"`, [a.id, a.date, a.wardId, JSON.stringify(a.doctorIds)]);
    }
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Bulk Import ---
app.post('/api/import', async (req, res) => {
  await getTablesReady();
  const { doctors } = req.body;
  if (isUsingMock) {
    if (doctors) {
        for (const d of doctors) {
            const idx = mockDb.doctors.findIndex(exist => exist.id === d.id);
            if (idx > -1) mockDb.doctors[idx] = d;
            else mockDb.doctors.push(d);
        }
    }
    return res.json({ success: true });
  }
  try {
    if (doctors) {
      for (const d of doctors) {
        await pool.query(`INSERT INTO doctors (id, name, gender, "previousWards") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gender = EXCLUDED.gender, "previousWards" = EXCLUDED."previousWards"`, [d.id, d.name, d.gender, JSON.stringify(d.previousWards)]);
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Debug ---
app.get('/api/debug-db', async (req, res) => {
  try {
    await ensureTables();
    const { rows } = await pool.query('SELECT NOW() as now');
    res.json({ status: 'connected', time: rows[0].now, mode: isUsingMock ? 'mock' : 'postgres' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message, mode: isUsingMock ? 'mock' : 'postgres' });
  }
});

export default app;
