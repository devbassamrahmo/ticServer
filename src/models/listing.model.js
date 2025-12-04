// src/models/listing.model.js
const db = require('../config/db');

// ملاحظة: مؤقتاً عم نستخدم user.id كـ dealer_id
async function createListing(data) {
  const {
    dealer_id,
    site_id,
    type,
    title,
    description,
    price,
    currency,
    status,
    license_status,
    city,
    category,
    is_published,
    extraData,
  } = data;

  const result = await db.query(
    `INSERT INTO listings (
      dealer_id, site_id, type, title, description,
      price, currency, status, license_status,
      city, category, is_published, data
    ) VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,
      $10,$11,$12,$13
    )
    RETURNING *`,
    [
      dealer_id,
      site_id,
      type,
      title,
      description,
      price,
      currency || 'SAR',
      status || 'draft',
      license_status || 'pending',
      city,
      category,
      is_published ?? false,
      extraData || {},
    ]
  );

  return result.rows[0];
}

async function getListingsForDealer({
  dealer_id,
  status,
  type,
  search,
  city,
  page = 1,
  pageSize = 10,
}) {
  const conditions = ['l.dealer_id = $1'];
  const params = [dealer_id];
  let idx = params.length + 1;

  if (status) {
    conditions.push(`l.status = $${idx++}`);
    params.push(status);
  }

  if (type) {
    conditions.push(`l.type = $${idx++}`);
    params.push(type);
  }

  if (city) {
    conditions.push(`l.city ILIKE $${idx++}`);
    params.push(`%${city}%`);
  }

  if (search) {
    conditions.push(`(l.title ILIKE $${idx} OR l.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const offset = (page - 1) * pageSize;

  const listQuery = `
    SELECT
      l.*,
      COALESCE(SUM(CASE WHEN e.event_type = 'view' THEN 1 END), 0) AS views,
      COALESCE(SUM(CASE WHEN e.event_type IN ('whatsapp_click', 'call_click') THEN 1 END), 0) AS contacts
    FROM listings l
    LEFT JOIN listing_events e ON e.listing_id = l.id
    ${where}
    GROUP BY l.id
    ORDER BY l.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM listings l
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

module.exports = {
  createListing,
  getListingsForDealer,
  updateListing,
  deleteListing,
};

async function updateListing(id, dealer_id, fields) {
  const allowedFields = [
    'title', 'description', 'price', 'currency',
    'status', 'license_status', 'city',
    'category', 'is_published', 'data',
  ];

  const setParts = [];
  const params = [];
  let idx = 1;

  for (const key of allowedFields) {
    if (fields[key] !== undefined) {
      setParts.push(`${key} = $${idx++}`);
      params.push(fields[key]);
    }
  }

  if (!setParts.length) return null;

  // dealer_id شرط أمان
  params.push(id);
  params.push(dealer_id);

  const query = `
    UPDATE listings
    SET ${setParts.join(', ')}, updated_at = NOW()
    WHERE id = $${idx++} AND dealer_id = $${idx}
    RETURNING *
  `;

  const result = await db.query(query, params);
  return result.rows[0] || null;
}

async function deleteListing(id, dealer_id) {
  const result = await db.query(
    `DELETE FROM listings
     WHERE id = $1 AND dealer_id = $2`,
    [id, dealer_id]
  );

  return result.rowCount > 0;
}

module.exports = {
  createListing,
  getListingsForDealer,
  updateListing,
  deleteListing,
};
