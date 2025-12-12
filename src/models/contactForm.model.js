// src/models/contactForm.model.js
const db = require('../config/db');

async function createContactForm({ site_id, full_name, email, phone, message }) {
  const res = await db.query(
    `INSERT INTO contact_forms (site_id, full_name, email, phone, message)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [site_id || null, full_name, email || null, phone || null, message]
  );
  return res.rows[0];
}

async function getContactForms({ site_id, page = 1, pageSize = 20 }) {
  const params = [];
  const whereParts = [];
  let idx = 1;

  if (site_id) {
    whereParts.push(`site_id = $${idx++}`);
    params.push(site_id);
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const listQuery = `
    SELECT *
    FROM contact_forms
    ${where}
    ORDER BY created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM contact_forms
    ${where}
  `;

  const [listRes, countRes] = await Promise.all([
    db.query(listQuery, params),
    db.query(countQuery, params),
  ]);

  return {
    items: listRes.rows,
    total: Number(countRes.rows[0].total),
    page,
    pageSize,
  };
}

async function getContactFormById(id) {
  const res = await db.query(
    `SELECT * FROM contact_forms WHERE id = $1 LIMIT 1`,
    [id]
  );
  return res.rows[0] || null;
}

module.exports = {
  createContactForm,
  getContactForms,
  getContactFormById,
};
