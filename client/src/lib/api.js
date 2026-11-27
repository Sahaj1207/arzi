// Small fetch wrapper for the Arzi API. Always resolves to { ok, data | error }
// so screens can show a friendly message instead of crashing.
export async function api(path, options = {}) {
  try {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { ok: true, data } : { ok: false, status: res.status, error: data?.error ?? 'request_failed', data };
  } catch {
    return { ok: false, status: 0, error: 'network_error' };
  }
}
