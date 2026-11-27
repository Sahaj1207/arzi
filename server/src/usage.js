// Daily cap on paid API calls, per anonymous user AND per IP (the user ID in
// localStorage is easy to reset, the IP is not), so a public link cannot burn
// all the credits. Counts live in the `usage` table, one row per subject per day.
import { db } from './db.js';
import { config } from './config.js';
import { ProviderError } from './providers/sarvam.js';

const today = () => new Date().toISOString().slice(0, 10);
const get = db.prepare('SELECT count FROM usage WHERE subject = ? AND day = ?');
const bump = db.prepare(`
  INSERT INTO usage (subject, day, count) VALUES (?, ?, 1)
  ON CONFLICT(subject, day) DO UPDATE SET count = count + 1`);

// Throws ProviderError('limit') when either cap is reached; otherwise counts the call.
export function takeQuota({ userId, ip }) {
  const day = today();
  const user = `user:${userId || 'anonymous'}`;
  const addr = `ip:${ip || 'unknown'}`;
  if ((get.get(user, day)?.count ?? 0) >= config.limits.perUserPerDay) {
    throw new ProviderError('limit', 'daily limit for this user reached');
  }
  if ((get.get(addr, day)?.count ?? 0) >= config.limits.perIpPerDay) {
    throw new ProviderError('limit', 'daily limit for this network reached');
  }
  db.transaction(() => {
    bump.run(user, day);
    bump.run(addr, day);
  })();
}
