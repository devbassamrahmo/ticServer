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

async function getSubUsers(ownerId, filters = {}, pagination = {}) {
  const {
    city,
    type,   // ✅ موجود بالـ query بس ما عاد نستخدمه بالـ DB لأن user_type غير موجود
    status, // "active" | "inactive"
  } = filters;

  const page = Number(pagination.page) || 1;
  const pageSize = Number(pagination.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  const whereParts = ['owner_id = $1'];
  const params = [ownerId];
  let idx = params.length + 1;

  function addFilter(condition, value) {
    if (value !== undefined && value !== null && value !== '') {
      whereParts.push(condition.replace(/\?/g, `$${idx++}`));
      params.push(value);
    }
  }

  if (city) {
    addFilter('city = ?', city);
  }

  // ✅ FIX: user_type غير موجود بالجدول، لذلك لا فلترة على type
  // if (type) {
  //   addFilter('user_type = ?', type);
  // }

  if (status === 'active') {
    whereParts.push('is_active = TRUE');
  } else if (status === 'inactive') {
    whereParts.push('is_active = FALSE');
  }

  const whereClause = whereParts.join(' AND ');

  const listQuery = `
    SELECT
      id,
      full_name,
      phone,
      email,
      city,
      is_active,
      created_at
    FROM sub_users
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM sub_users
    WHERE ${whereClause}
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

// ✅ NEW: update sub user (full_name, phone, email, city)
async function updateSubUser(ownerId, subUserId, data = {}) {
  const allowedFields = ['full_name', 'phone', 'email', 'city'];

  const setParts = [];
  const params = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      setParts.push(`${field} = $${idx++}`);
      params.push(data[field]);
    }
  }

  // ما في ولا حقل للتعديل
  if (setParts.length === 0) {
    return null;
  }

  // WHERE
  params.push(subUserId);
  const idParam = `$${idx++}`;

  params.push(ownerId);
  const ownerParam = `$${idx++}`;

  const query = `
    UPDATE sub_users
    SET ${setParts.join(', ')}
    WHERE id = ${idParam} AND owner_id = ${ownerParam}
    RETURNING id, full_name, phone, email, city, is_active, created_at
  `;

  const result = await db.query(query, params);
  return result.rows[0] || null;
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
  updateSubUser, // ✅ NEW
  toggleSubUser,
  deleteSubUser,
  getSubUsers,
};
