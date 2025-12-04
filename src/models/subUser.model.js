// src/models/subUser.model.js
const db = require('../config/db');

async function listSubUsers(ownerId, { page = 1, pageSize = 10 }) {
  const offset = (page - 1) * pageSize;

  const listQuery = `
    SELECT id, full_name, phone, email, city, is_active, created_at
    FROM sub_users
    WHERE owner_id = $1
    ORDER BY created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM sub_users
    WHERE owner_id = $1
  `;

  const [listRes, countRes] = await Promise.all([
    db.query(listQuery, [ownerId]),
    db.query(countQuery, [ownerId]),
  ]);

  return {
    items: listRes.rows,
    total: Number(countRes.rows[0].total),
    page,
    pageSize,
  };
}

async function createSubUser(ownerId, data) {
  const { full_name, phone, email, city } = data;

  const result = await db.query(
    `INSERT INTO sub_users (owner_id, full_name, phone, email, city)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [ownerId, full_name, phone, email, city]
  );

  return result.rows[0];
}

async function toggleSubUser(ownerId, subUserId, isActive) {
  const result = await db.query(
    `UPDATE sub_users
     SET is_active = $1
     WHERE id = $2 AND owner_id = $3
     RETURNING *`,
    [isActive, subUserId, ownerId]
  );

  return result.rows[0] || null;
}

async function deleteSubUser(ownerId, subUserId) {
  const result = await db.query(
    `DELETE FROM sub_users
     WHERE id = $1 AND owner_id = $2`,
    [subUserId, ownerId]
  );

  return result.rowCount > 0;
}

module.exports = {
  listSubUsers,
  createSubUser,
  toggleSubUser,
  deleteSubUser,
};
