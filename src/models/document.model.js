// src/models/document.model.js
const db = require('../config/db');

function mapDocRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    document_type: row.document_type,
    file_url: row.file_url,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    reject_reason: row.reject_reason,
    created_at: row.created_at,
  };
}

// تستخدمها واجهة الحساب عند اليوزر نفسه
async function createAccountDocument(userId, { document_type, file_url }) {
  const result = await db.query(
    `INSERT INTO account_documents (user_id, document_type, file_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, document_type, file_url]
  );
  return mapDocRow(result.rows[0]);
}

// ====== للـ admin ======

async function getDocumentsForAdmin({ status, document_type, page = 1, pageSize = 20 }) {
  const where = [];
  const params = [];
  let idx = 1;

  if (status) {
    where.push(`d.status = $${idx++}`);
    params.push(status);
  }

  if (document_type) {
    where.push(`d.document_type = $${idx++}`);
    params.push(document_type);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const offset = (page - 1) * pageSize;

  const listQuery = `
    SELECT
      d.*,
      u.full_name,
      u.company_name,
      u.phone,
      u.city,
      u.sector
    FROM account_documents d
    JOIN users u ON u.id = d.user_id
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM account_documents d
    ${whereClause}
  `;

  const [listRes, countRes] = await Promise.all([
    db.query(listQuery, params),
    db.query(countQuery, params),
  ]);

  return {
    items: listRes.rows.map((row) => ({
      ...mapDocRow(row),
      user: {
        id: row.user_id,
        full_name: row.full_name,
        company_name: row.company_name,
        phone: row.phone,
        city: row.city,
        sector: row.sector,
      },
    })),
    total: Number(countRes.rows[0].total),
    page,
    pageSize,
  };
}



// وثائق يوزر معيّن (مفيدة لصفحة بروفايل داخل لوحة الأدمن)
async function getUserDocumentsForAdmin(userId) {
  const res = await db.query(
    `SELECT * FROM account_documents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows.map(mapDocRow);
}

async function reviewDocument(docId, adminId, { status, reject_reason }) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('INVALID_STATUS');
  }

  const res = await db.query(
    `UPDATE account_documents
     SET status = $1,
         reviewed_by = $2,
         reviewed_at = NOW(),
         reject_reason = $3
     WHERE id = $4
     RETURNING *`,
    [status, adminId, reject_reason || null, docId]
  );

  return res.rows[0] ? mapDocRow(res.rows[0]) : null;
}

async function getAccountDocumentsForUser(userId, { document_type } = {}) {
  const params = [userId];
  let where = 'user_id = $1';
  let idx = 2;

  if (document_type) {
    where += ` AND document_type = $${idx++}`;
    params.push(document_type);
  }

  const res = await db.query(
    `SELECT *
     FROM account_documents
     WHERE ${where}
     ORDER BY created_at DESC`,
    params
  );

  return res.rows.map(mapDocRow);
}

module.exports = {
  createAccountDocument,
  getDocumentsForAdmin,
  getUserDocumentsForAdmin,
  reviewDocument,
  getAccountDocumentsForUser
};
