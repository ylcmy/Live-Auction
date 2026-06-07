/**
 * Artillery Socket.IO scenario processor
 *
 * Handles per-VU lifecycle:
 *   1. Register + login (HTTP) → get JWT token
 *   2. Socket.IO connect with auth
 *   3. Business events (join room, bid, etc.)
 */

const crypto = require('crypto');

// ── Helper: generate unique username ────────────────────────────────────────
function uniqueUsername(context, events, done) {
  const vuId = context.vars.__vu || crypto.randomUUID().slice(0, 8);
  context.vars.username = `artillery_${vuId}_${Date.now()}`;
  context.vars.password = 'Test1234!';
  context.vars.nickname = `ArtUser_${vuId}`;
  return done();
}

// ── Helper: extract token from login response ──────────────────────────────
function extractToken(context, events, done) {
  const resp = context.vars._loginResponse;
  if (resp) {
    try {
      const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
      context.vars.token = body?.data?.accessToken;
    } catch (e) {
      // parse failure
    }
  }
  return done();
}

// ── Helper: set socketio auth options ───────────────────────────────────────
function setSocketAuth(context, events, done) {
  context.vars.$socketioConnectionParams = {
    auth: { token: context.vars.token },
  };
  return done();
}

// ── Helper: generate idempotency key ────────────────────────────────────────
function generateIdempotencyKey(context, events, done) {
  context.vars.idempotencyKey = crypto.randomUUID();
  return done();
}

// ── Helper: log bid response ────────────────────────────────────────────────
function onBidResponse(data, context, events, done) {
  if (data && data.amount) {
    context.vars._lastBidAmount = data.amount;
    context.vars._lastBidRank = data.rank;
  }
  return done();
}

module.exports = {
  uniqueUsername,
  extractToken,
  setSocketAuth,
  generateIdempotencyKey,
  onBidResponse,
};
