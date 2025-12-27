// src/models/report.model.js
const db = require('../config/db');

function clampInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

async function createAdReport({
  item_type,
  item_id,
  site_id,
  description,
  reporter_user_id = null,
  reporter_email = null,
  reporter_phone = null,
  ip = null,
  user_agent = null,
}) {
  const res = await db.query(
    `INSERT INTO ad_reports (
      item_type, item_id, site_id, description,
      reporter_user_id, reporter_email, reporter_phone,
      ip, user_agent
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [
      item_type,
      item_id,
      site_id,
      description,
      reporter_user_id,
      reporter_email,
      reporter_phone,
      ip,
      user_agent,
    ]
  );

  return res.rows[0];
}

async function listAdReports(filters = {}, pagination = {}) {
  const page = clampInt(pagination.page ?? filters.page, 1) || 1;
  const pageSize = clampInt(pagination.pageSize ?? filters.pageSize, 20) || 20;
  const offset = (page - 1) * pageSize;

  const conditions = ['1=1'];
  const params = [];
  let idx = 1;

  if (filters.status && ['open', 'closed'].includes(filters.status)) {
    conditions.push(`r.status = $${idx++}`);
    params.push(filters.status);
  }

  if (filters.item_type && ['car', 'listing'].includes(filters.item_type)) {
    conditions.push(`r.item_type = $${idx++}`);
    params.push(filters.item_type);
  }

  if (filters.site_id) {
    conditions.push(`r.site_id = $${idx++}`);
    params.push(filters.site_id);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const listRes = await db.query(
    `SELECT r.*
     FROM ad_reports r
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, pageSize, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) AS total
     FROM ad_reports r
     ${where}`,
    params
  );

  return {
    items: listRes.rows,
    total: Number(countRes.rows[0].total),
    page,
    pageSize,
  };
}

async function closeReport(reportId) {
  const res = await db.query(
    `UPDATE ad_reports
     SET status = 'closed'
     WHERE id = $1
     RETURNING *`,
    [reportId]
  );
  return res.rows[0] || null;
}

async function deleteReportsForItem(item_type, item_id) {
  await db.query(
    `DELETE FROM ad_reports
     WHERE item_type = $1 AND item_id = $2`,
    [item_type, item_id]
  );
  return true;
}

module.exports = {
  createAdReport,
  listAdReports,
  closeReport,
  deleteReportsForItem,
};
