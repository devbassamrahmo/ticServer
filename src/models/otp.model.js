// src/models/otp.model.js
const db = require('../config/db');

async function createOtp(phone, code, expiresAt) {
  await db.query(
    `INSERT INTO otp_codes (phone, code, expires_at)
     VALUES ($1, $2, $3)`,
    [phone, code, expiresAt]
  );
}

async function findValidOtp(phone, code) {
  const result = await db.query(
    `SELECT *
     FROM otp_codes
     WHERE phone = $1
       AND code = $2
       AND used = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, code]
  );
  const row = result.rows[0];
  if (!row) return null;

  const now = new Date();
  const expiresAt = new Date(row.expires_at);
  if (expiresAt < now) {
    return null;
  }

  return row;
}

async function markOtpUsed(id) {
  await db.query(
    `UPDATE otp_codes
     SET used = TRUE
     WHERE id = $1`,
    [id]
  );
}

module.exports = {
  createOtp,
  findValidOtp,
  markOtpUsed,
};
