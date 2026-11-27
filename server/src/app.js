// Builds the Express app (no listen), so tests can start it on any port.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { publicConfig, REPO_ROOT } from './config.js';
import { db } from './db.js';
import { pdfRouter } from './routes/pdf.js';
import { documentsRouter, notesRouter } from './routes/documents.js';
import { advocateRouter } from './routes/advocate.js';
import { findChromium } from './pdf/render.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true); // correct client IPs behind Render's proxy (used by usage limits)
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const ok = db.prepare('SELECT 1 AS ok').get().ok === 1;
    res.json({ ok, time: new Date().toISOString() });
  });

  app.get('/api/config', (_req, res) => {
    res.json(publicConfig({ pdf: findChromium() ? 'server' : 'print' }));
  });

  app.use('/api/documents', documentsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/advocate', advocateRouter);
  app.use('/api/pdf', pdfRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // Serve the built frontend (client/dist). In development Vite serves it instead.
  const clientDist = path.join(REPO_ROOT, 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  } else {
    app.get('/', (_req, res) =>
      res.type('text').send('Arzi API is running. Frontend not built: run `npm run build` or use the Vite dev server.'),
    );
  }

  // Last-resort error handler: log it, answer with JSON, keep the server alive.
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
    console.error('[server] unhandled error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error' });
  });

  return app;
}
