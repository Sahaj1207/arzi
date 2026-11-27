// Arzi server entry point: start the app on PORT (default 3000).
import { config, publicConfig } from './config.js';
import { db } from './db.js';
import { createApp } from './app.js';
import { pdfEngine, closePdfBrowser } from './pdf/render.js';
import { seedDemoData } from './demo/sample.js';

// Demo data on every start (the Render free tier wipes the database). Never fatal.
try {
  const added = await seedDemoData();
  if (added) console.log(`  seeded ${added} sample case(s) for the demo advocate`);
} catch (err) {
  console.warn('[seed] could not add sample cases:', err.message);
}

const server = createApp().listen(config.port, () => {
  const p = publicConfig();
  console.log(`Arzi running on http://localhost:${config.port}`);
  console.log(`  speech: ${[...p.speechChain, 'browser'].join(' → ')} | tts: ${p.tts} | mode: ${p.mode} | pdf: ${pdfEngine()}`);
});

const shutdown = async () => {
  server.close();
  await closePdfBrowser();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
