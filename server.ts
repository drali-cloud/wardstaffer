import express from 'express';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Initialize Postgres
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/wardstaffer'
  });

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      "previousWards" TEXT NOT NULL -- JSON stringified array
    );

    CREATE TABLE IF NOT EXISTS wards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      requirements TEXT NOT NULL -- JSON stringified object
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      "wardId" TEXT NOT NULL,
      "doctorIds" TEXT NOT NULL -- JSON stringified array
    );
  `);

  // --- API Routes ---

  // Doctors
  app.get('/api/doctors', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM doctors');
    const doctors = rows.map(r => ({ ...r, previousWards: JSON.parse(r.previousWards) }));
    res.json(doctors);
  });

  app.post('/api/doctors', async (req, res) => {
    const { id, name, gender, previousWards } = req.body;
    await pool.query(
      'INSERT INTO doctors (id, name, gender, "previousWards") VALUES ($1, $2, $3, $4)',
      [id, name, gender, JSON.stringify(previousWards)]
    );
    res.status(201).json({ success: true });
  });

  app.delete('/api/doctors/:id', async (req, res) => {
    await pool.query('DELETE FROM doctors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  // Wards
  app.get('/api/wards', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM wards');
    const wards = rows.map(r => ({ ...r, requirements: JSON.parse(r.requirements) }));
    res.json(wards);
  });

  app.post('/api/wards', async (req, res) => {
    const { id, name, requirements } = req.body;
    await pool.query(
      'INSERT INTO wards (id, name, requirements) VALUES ($1, $2, $3)',
      [id, name, JSON.stringify(requirements)]
    );
    res.status(201).json({ success: true });
  });

  app.delete('/api/wards/:id', async (req, res) => {
    await pool.query('DELETE FROM wards WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  // Assignments
  app.get('/api/assignments', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM assignments');
    const assignments = rows.map(r => ({ ...r, doctorIds: JSON.parse(r.doctorIds) }));
    res.json(assignments);
  });

  app.post('/api/assignments', async (req, res) => {
    const assignments = Array.isArray(req.body) ? req.body : [req.body];
    for (const a of assignments) {
      await pool.query(
        'INSERT INTO assignments (id, date, "wardId", "doctorIds") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, "wardId" = EXCLUDED."wardId", "doctorIds" = EXCLUDED."doctorIds"',
        [a.id, a.date, a.wardId, JSON.stringify(a.doctorIds)]
      );
    }
    res.status(201).json({ success: true });
  });

  app.delete('/api/assignments', async (req, res) => {
    await pool.query('DELETE FROM assignments');
    res.json({ success: true });
  });

  // Bulk Import
  app.post('/api/import', async (req, res) => {
      const { doctors, wards, assignments } = req.body;
      
      if (doctors) {
          for (const d of doctors) {
              await pool.query(
                  'INSERT INTO doctors (id, name, gender, "previousWards") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gender = EXCLUDED.gender, "previousWards" = EXCLUDED."previousWards"', 
                  [d.id, d.name, d.gender, JSON.stringify(d.previousWards)]
              );
          }
      }
      res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
