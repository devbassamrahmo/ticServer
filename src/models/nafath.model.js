// src/models/nafath.model.js
const db = require('../config/db');

async function createNafathLogin({
  user_id,
  national_id,
  request_id, // عندك حالياً = transId (كما بالكنترولر)
  channel = 'web',
  raw_response = {},
}) {
  const res = await db.query(
    `INSERT INTO nafath_logins (
      user_id, national_id, request_id, channel, raw_response
    ) VALUES ($1,$2,$3,$4,$5)
    RETURNING *`,
    [user_id, national_id, request_id, channel, raw_response]
  );
  return res.rows[0];
}

/**
 * ✅ نخليها تكتب raw_response كما هو (بعد ما نعمل merge بالكنترولر)
 */
async function updateNafathStatusByRequestId(request_id, { status, raw_response }) {
  const res = await db.query(
    `UPDATE nafath_logins
     SET status = $1,
         raw_response = $2,
         updated_at = NOW()
     WHERE request_id = $3
     RETURNING *`,
    [status, raw_response, request_id]
  );
  return res.rows[0] || null;
}

async function findByRequestId(request_id) {
  const res = await db.query(
    `SELECT * FROM nafath_logins WHERE request_id = $1 LIMIT 1`,
    [request_id]
  );
  return res.rows[0] || null;
}

module.exports = {
  createNafathLogin,
  updateNafathStatusByRequestId,
  findByRequestId,
};
