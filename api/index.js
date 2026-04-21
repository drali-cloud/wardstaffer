import express from 'express';
import { createPool } from '@vercel/postgres';

const app = express();
app.use(express.json());

// Connect using DATABASE_URL or POSTGRES_URL
const pool = createPool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});

async function ensureTables() {
  console.log('Synchronizing with WSDB database...');
  try {
    // Create tables if they don't exist
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
    console.log('WSDB Synchronization Complete.');
  } catch (err) {
    console.error('WSDB Sync Error:', err.message);
  }
}

let tablesReady = null;
async function getTablesReady() {
  if (!tablesReady) {
    tablesReady = ensureTables().catch(err => {
      tablesReady = null;
      throw err;
    });
  }
  return tablesReady;
}

// --- Doctors ---
app.get('/api/doctors', async (req, res) => {
  try {
    await getTablesReady();
    const { rows } = await pool.query('SELECT * FROM doctors ORDER BY name ASC');
    res.json(rows.map(r => ({ ...r, previousWards: JSON.parse(r.previousWards) })));
  } catch (e) {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/doctors/:id', async (req, res) => {
  try {
    await getTablesReady();
    const { name, gender, previousWards } = req.body;
    await pool.query(
      'UPDATE doctors SET name = $1, gender = $2, "previousWards" = $3 WHERE id = $4',
      [name, gender, JSON.stringify(previousWards), req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/doctors/:id', async (req, res) => {
  try {
    await getTablesReady();
    await pool.query('DELETE FROM doctors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Wards ---
app.get('/api/wards', async (req, res) => {
  try {
    await getTablesReady();
    const { rows } = await pool.query('SELECT * FROM wards');
    res.json(rows.map(r => ({ ...r, requirements: JSON.parse(r.requirements) })));
  } catch (e) {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/wards/:id', async (req, res) => {
  try {
    await getTablesReady();
    const { name, requirements } = req.body;
    await pool.query(
      'UPDATE wards SET name = $1, requirements = $2 WHERE id = $3',
      [name, JSON.stringify(requirements), req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/wards/:id', async (req, res) => {
  try {
    await getTablesReady();
    await pool.query('DELETE FROM wards WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Assignments ---
app.get('/api/assignments', async (req, res) => {
  try {
    await getTablesReady();
    const { rows } = await pool.query('SELECT * FROM assignments');
    res.json(rows.map(r => ({ ...r, doctorIds: JSON.parse(r.doctorIds) })));
  } catch (e) {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/assignments', async (req, res) => {
  try {
    await getTablesReady();
    await pool.query('DELETE FROM assignments');
    res.json({ success: true });
  } catch (e) {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Debug ---
app.get('/api/debug-db', async (req, res) => {
  try {
    await getTablesReady();
    const { rows } = await pool.query('SELECT NOW() as now');
    res.json({ status: 'connected', time: rows[0].now, env: { 
      has_database_url: !!process.env.DATABASE_URL,
      has_postgres_url: !!process.env.POSTGRES_URL 
    }});
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

export default app;
