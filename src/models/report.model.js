// src/models/report.model.js
const db = require('../config/db');

function mapReportRow(r) {
  return {
    id: r.id,
    site_id: r.site_id,
    owner_id: r.owner_id,
    target_type: r.target_type,
    target_id: r.target_id,
    reason: r.reason,
    message: r.message,
    reporter_name: r.reporter_name,
    reporter_email: r.reporter_email,
    reporter_phone: r.reporter_phone,
    reporter_ip: r.reporter_ip,
    user_agent: r.user_agent,
    status: r.status,
    closed_by: r.closed_by,
    closed_at: r.closed_at,
    created_at: r.created_at,
  };
}

/**
 * Create report (public)
 */
async function createReport({
  site_id,
  owner_id,
  target_type,
  target_id,
  reason,
  message,
  reporter_name,
  reporter_email,
  reporter_phone,
  reporter_ip,
  user_agent,
}) {
  const res = await db.query(
    `INSERT INTO reports (
      site_id, owner_id, target_type, target_id,
      reason, message,
      reporter_name, reporter_email, reporter_phone,
      reporter_ip, user_agent
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *`,
    [
      site_id,
      owner_id,
      target_type,
      target_id,
      reason,
      message || null,
      reporter_name || null,
      reporter_email || null,
      reporter_phone || null,
      reporter_ip || null,
      user_agent || null,
    ]
  );

  return mapReportRow(res.rows[0]);
}

/**
 * Admin list reports with filters + pagination
 */
async function listReportsForAdmin({ status, sector, reason, q, page = 1, pageSize = 20 }) {
  const where = [];
  const params = [];
  let idx = 1;

  if (status) {
    where.push(`r.status = $${idx++}`);
    params.push(status);
  }

  if (sector) {
    where.push(`s.sector = $${idx++}`);
    params.push(sector);
  }

  if (reason) {
    where.push(`r.reason = $${idx++}`);
    params.push(reason);
  }

  if (q) {
    where.push(`(
      COALESCE(r.message,'') ILIKE $${idx}
      OR COALESCE(r.reporter_name,'') ILIKE $${idx}
      OR COALESCE(r.reporter_phone,'') ILIKE $${idx}
      OR COALESCE(s.slug,'') ILIKE $${idx}
    )`);
    params.push(`%${q}%`);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const listRes = await db.query(
    `SELECT
      r.*,
      s.slug AS site_slug,
      s.sector AS site_sector
     FROM reports r
     JOIN sites s ON s.id = r.site_id
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  const countRes = await db.query(
    `SELECT COUNT(*) AS total
     FROM reports r
     JOIN sites s ON s.id = r.site_id
     ${whereClause}`,
    params
  );

  return {
    items: listRes.rows.map((row) => ({
      ...mapReportRow(row),
      site_slug: row.site_slug,
      site_sector: row.site_sector,
    })),
    total: Number(countRes.rows[0].total),
    page,
    pageSize,
  };
}

/**
 * Admin get one report (details)
 */
async function getReportByIdForAdmin(reportId) {
  const res = await db.query(
    `SELECT
      r.*,
      s.slug AS site_slug,
      s.sector AS site_sector
     FROM reports r
     JOIN sites s ON s.id = r.site_id
     WHERE r.id = $1
     LIMIT 1`,
    [reportId]
  );

  if (!res.rows[0]) return null;

  const row = res.rows[0];
  return {
    ...mapReportRow(row),
    site_slug: row.site_slug,
    site_sector: row.site_sector,
  };
}

/**
 * Admin update status
 * - If status becomes 'closed' => set closed_by/closed_at
 * - Otherwise keep current closed_by/closed_at as-is
 */
async function updateReportStatus(reportId, status, adminId) {
  const res = await db.query(
    `UPDATE reports
     SET status = $2,
         closed_by = CASE WHEN $2 = 'closed' THEN $3 ELSE closed_by END,
         closed_at = CASE WHEN $2 = 'closed' THEN NOW() ELSE closed_at END
     WHERE id = $1
     RETURNING *`,
    [reportId, status, adminId]
  );
  return res.rows[0] ? mapReportRow(res.rows[0]) : null;
}

/**
 * Admin close shortcut
 */
async function closeReport(reportId, adminId) {
  const res = await db.query(
    `UPDATE reports
     SET status = 'closed', closed_by = $2, closed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [reportId, adminId]
  );
  return res.rows[0] ? mapReportRow(res.rows[0]) : null;
}

module.exports = {
  createReport,
  listReportsForAdmin,
  getReportByIdForAdmin,
  updateReportStatus,
  closeReport,
};
