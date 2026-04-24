import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import apiRoutes from './api/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const PORT = process.env.PORT || 3000;
  const app = express(); // Create an express app instance here.

  // IMPORTANT: Mount API routes BEFORE static/catch-all
  app.use(apiRoutes);

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
    app.get('*', (_req, res) => { // Use app.get('*') to handle all routes
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();