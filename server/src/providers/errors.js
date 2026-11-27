// One error type for every paid provider. `kind` tells the caller what to do:
// 'quota' (out of credits / rate limit), 'auth' (bad key), 'unavailable'
// (timeout, 5xx), 'bad_request', 'not_configured', 'no_consent', 'limit'.
export class ProviderError extends Error {
  // retryMs: how long to leave this service alone (e.g. from a rate limit), if known.
  constructor(kind, message, status = null, retryMs = null) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.retryMs = retryMs;
  }
}
