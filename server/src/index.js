// Arzi server: JSON API under /api, plus the built React app for everything else.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config, publicConfig, REPO_ROOT } from './config.js';
import { db } from './db.js';
import { pdfRouter } from './routes/pdf.js';
import { findChromium, closePdfBrowser } from './pdf/render.js';

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
  console.error('[server] unhandled error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'server_error' });
});

const server = app.listen(config.port, () => {
  const p = publicConfig();
  console.log(`Arzi running on http://localhost:${config.port}`);
  console.log(`  speech: ${p.speech} | tts: ${p.tts} | mode: ${p.mode} | pdf: ${findChromium() ? 'chromium' : 'print fallback'}`);
});

const shutdown = async () => {
  server.close();
  await closePdfBrowser();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
