import express from 'express';
import { createPool } from '@vercel/postgres';

const app = express();
app.use(express.json());

const pool = createPool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      "previousWards" TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      requirements TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      "wardId" TEXT NOT NULL,
      "doctorIds" TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      period TEXT NOT NULL,
      day INTEGER NOT NULL,
      "wardId" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "slotIndex" INTEGER NOT NULL
    )
  `);
}

// Ensure tables exist on every cold start
let tablesReady: Promise<void> | null = null;
function getTablesReady() {
  if (!tablesReady) tablesReady = ensureTables();
  return tablesReady;
}

// --- Doctors ---
app.get('/api/doctors', async (req, res) => {
  try {
    await getTablesReady();
    const { rows } = await pool.query('SELECT * FROM doctors');
    res.json(rows.map(r => ({ ...r, previousWards: JSON.parse(r.previousWards) })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/doctors', async (req, res) => {
  try {
    await getTablesReady();
    const { id, name, gender, previousWards } = req.body;
    await pool.query(
      'INSERT INTO doctors (id, name, gender, "previousWards") VALUES ($1, $2, $3, $4)',
      [id, name, gender, JSON.stringify(previousWards)]
    );
    res.status(201).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/doctors/:id', async (req, res) => {
  try {
    await getTablesReady();
    await pool.query('DELETE FROM doctors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Wards ---
app.get('/api/wards', async (req, res) => {
  try {
    await getTablesReady();
    const { rows } = await pool.query('SELECT * FROM wards');
    res.json(rows.map(r => ({ ...r, requirements: JSON.parse(r.requirements) })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/wards', async (req, res) => {
  try {
    await getTablesReady();
    const { id, name, requirements } = req.body;
    await pool.query(
      'INSERT INTO wards (id, name, requirements) VALUES ($1, $2, $3)',
      [id, name, JSON.stringify(requirements)]
    );
    res.status(201).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/wards/:id', async (req, res) => {
  try {
    await getTablesReady();
    await pool.query('DELETE FROM wards WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Assignments ---
app.get('/api/assignments', async (req, res) => {
  try {
    await getTablesReady();
    const { rows } = await pool.query('SELECT * FROM assignments');
    res.json(rows.map(r => ({ ...r, doctorIds: JSON.parse(r.doctorIds) })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/assignments', async (req, res) => {
  try {
    await getTablesReady();
    const assignments = Array.isArray(req.body) ? req.body : [req.body];
    for (const a of assignments) {
      await pool.query(
        `INSERT INTO assignments (id, date, "wardId", "doctorIds")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           date = EXCLUDED.date,
           "wardId" = EXCLUDED."wardId",
           "doctorIds" = EXCLUDED."doctorIds"`,
        [a.id, a.date, a.wardId, JSON.stringify(a.doctorIds)]
      );
    }
    res.status(201).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Shifts ---
app.get('/api/shifts', async (req, res) => {
  try {
    await getTablesReady();
    const { rows } = await pool.query('SELECT * FROM shifts');
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/shifts', async (req, res) => {
  try {
    await getTablesReady();
    const shifts = Array.isArray(req.body) ? req.body : [req.body];
    for (const s of shifts) {
      await pool.query(
        `INSERT INTO shifts (id, period, day, "wardId", "doctorId", "slotIndex")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           period = EXCLUDED.period,
           day = EXCLUDED.day,
           "wardId" = EXCLUDED."wardId",
           "doctorId" = EXCLUDED."doctorId",
           "slotIndex" = EXCLUDED."slotIndex"`,
        [s.id, s.period, s.day, s.wardId, s.doctorId, s.slotIndex]
      );
    }
    res.status(201).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/shifts', async (req, res) => {
  try {
    await getTablesReady();
    const { period, type, day, wardId } = req.body;
    let query = 'DELETE FROM shifts WHERE period = $1';
    let params = [period];
    
    if (type === 'er') {
      query += " AND (\"wardId\" LIKE 'er-%' OR \"wardId\" = 'referral')";
    } else if (type === 'ward') {
      query += " AND \"wardId\" NOT LIKE 'er-%' AND \"wardId\" != 'referral'";
    } else if (day && wardId) {
      query += ' AND day = $2 AND "wardId" = $3';
      params.push(day, wardId);
    }

    await pool.query(query, params);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/assignments', async (req, res) => {
  try {
    await getTablesReady();
    await pool.query('DELETE FROM assignments');
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Clear Doctors & Wards ---
app.delete('/api/clear-database', async (req, res) => {
  try {
    await getTablesReady();
    await pool.query('BEGIN');
    await pool.query('DELETE FROM doctors');
    await pool.query('DELETE FROM wards');
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (e: any) {
    await pool.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

// --- Bulk Import ---
app.post('/api/import', async (req, res) => {
  try {
    await getTablesReady();
    const { doctors } = req.body;
    if (doctors) {
      for (const d of doctors) {
        await pool.query(
          `INSERT INTO doctors (id, name, gender, "previousWards")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             gender = EXCLUDED.gender,
             "previousWards" = EXCLUDED."previousWards"`,
          [d.id, d.name, d.gender, JSON.stringify(d.previousWards)]
        );
      }
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default app;
