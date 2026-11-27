// Arzi server entry point: start the app on PORT (default 3000).
import { config, publicConfig } from './config.js';
import { db } from './db.js';
import { createApp } from './app.js';
import { findChromium, closePdfBrowser } from './pdf/render.js';

const server = createApp().listen(config.port, () => {
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
