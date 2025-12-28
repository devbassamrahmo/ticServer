// src/models/payment.model.js
const db = require('../config/db');

async function createPaymentRecord({
  user_id,
  amount_halalas,
  currency = 'SAR',
  description,
  meta = {},
}) {
  const res = await db.query(
    `INSERT INTO payments (
      user_id, amount_halalas, currency, description, meta, status
    ) VALUES ($1,$2,$3,$4,$5,'created')
    RETURNING *`,
    [user_id, amount_halalas, currency, description, meta]
  );
  return res.rows[0];
}

async function attachGatewayInfo(localPaymentId, { gateway_payment_id }) {
  const res = await db.query(
    `UPDATE payments
     SET gateway_payment_id = $1, status = 'initiated', updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [gateway_payment_id, localPaymentId]
  );
  return res.rows[0] || null;
}

async function updatePaymentByGatewayId(gateway_payment_id, fields) {
  const allowed = ['status', 'gateway_fee_halalas', 'meta']; // شلنا updated_at

  const setParts = [];
  const params = [];
  let idx = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      setParts.push(`${key} = $${idx++}`);
      params.push(fields[key]);
    }
  }

  if (!setParts.length) return null;

  params.push(gateway_payment_id);

  const res = await db.query(
    `UPDATE payments
     SET ${setParts.join(', ')}, updated_at = NOW()
     WHERE gateway_payment_id = $${idx}
     RETURNING *`,
    params
  );

  return res.rows[0] || null;
}

async function findPaymentById(id) {
  const res = await db.query(`SELECT * FROM payments WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0] || null;
}

module.exports = {
  createPaymentRecord,
  attachGatewayInfo,
  updatePaymentByGatewayId,
  findPaymentById,
};
