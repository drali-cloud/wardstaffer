import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

// --- Doctors ---
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await prisma.doctor.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(doctors);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/doctors', async (req, res) => {
  try {
    const { id, name, gender, previousWards } = req.body;
    await prisma.doctor.create({
      data: { id, name, gender, previousWards }
    });
    res.status(201).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/doctors/:id', async (req, res) => {
  try {
    const { name, gender, previousWards } = req.body;
    await prisma.doctor.update({
      where: { id: req.params.id },
      data: { name, gender, previousWards }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/doctors/:id', async (req, res) => {
  try {
    await prisma.doctor.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Wards ---
app.get('/api/wards', async (req, res) => {
  try {
    const wards = await prisma.ward.findMany();
    res.json(wards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/wards', async (req, res) => {
  try {
    const { id, name, requirements } = req.body;
    await prisma.ward.create({
      data: { id, name, requirements }
    });
    res.status(201).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/wards/:id', async (req, res) => {
  try {
    const { name, requirements } = req.body;
    await prisma.ward.update({
      where: { id: req.params.id },
      data: { name, requirements }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/wards/:id', async (req, res) => {
  try {
    await prisma.ward.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Assignments ---
app.get('/api/assignments', async (req, res) => {
  try {
    const assignments = await prisma.assignment.findMany();
    res.json(assignments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/assignments', async (req, res) => {
  try {
    const assignments = Array.isArray(req.body) ? req.body : [req.body];
    for (const a of assignments) {
      await prisma.assignment.upsert({
        where: { id: a.id },
        update: { date: a.date, wardId: a.wardId, doctorIds: a.doctorIds },
        create: { id: a.id, date: a.date, wardId: a.wardId, doctorIds: a.doctorIds }
      });
    }
    res.status(201).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/assignments', async (req, res) => {
  try {
    await prisma.assignment.deleteMany();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Bulk Import ---
app.post('/api/import', async (req, res) => {
  try {
    const { doctors } = req.body;
    if (doctors) {
      for (const d of doctors) {
        await prisma.doctor.upsert({
          where: { id: d.id },
          update: { name: d.name, gender: d.gender, previousWards: d.previousWards },
          create: { id: d.id, name: d.name, gender: d.gender, previousWards: d.previousWards }
        });
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
    await prisma.$connect();
    res.json({ status: 'connected', orm: 'prisma' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

export default app;
