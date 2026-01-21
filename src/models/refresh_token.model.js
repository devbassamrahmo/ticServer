// src/models/refresh_token.model.js
const db = require('../config/db');

async function createRefreshTokenRow({
  user_id,
  token_hash,
  expires_at,
  user_agent,
  ip,
}) {
  const res = await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, token_hash, expires_at, created_at`,
    [user_id, token_hash, expires_at, user_agent || null, ip || null]
  );
  return res.rows[0];
}

async function findValidRefreshTokenByHash(token_hash) {
  const res = await db.query(
    `SELECT *
     FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [token_hash]
  );
  return res.rows[0] || null;
}

async function revokeRefreshToken(token_hash, { replaced_by_hash } = {}) {
  const res = await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(),
         replaced_by_hash = COALESCE($2, replaced_by_hash)
     WHERE token_hash = $1
       AND revoked_at IS NULL
     RETURNING id, user_id, revoked_at, replaced_by_hash`,
    [token_hash, replaced_by_hash || null]
  );
  return res.rows[0] || null;
}

async function revokeAllForUser(user_id) {
  const res = await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL
     RETURNING id`,
    [user_id]
  );
  return res.rows;
}

module.exports = {
  createRefreshTokenRow,
  findValidRefreshTokenByHash,
  revokeRefreshToken,
  revokeAllForUser,
};
