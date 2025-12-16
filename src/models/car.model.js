// src/models/car.model.js
const db = require('../config/db');

function normalizeArrayMax10(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 10);
}
function normalizeFeatures(features) {
  return Array.isArray(features) ? features : [];
}

// ==========================
// Private (Dashboard)
// ==========================
async function createCarListing({ dealer_id, site_id, data }) {
  const {
    title,
    description,
    brand,
    model,
    trim,
    year,
    category,
    condition,
    mileage,
    exterior_color,
    interior_color,
    price,
    fuel_type,
    transmission,
    engine_size,
    drive_type,
    cylinders,
    features,
    images,
    whatsapp_enabled,
    phone_enabled,
    importer,
    engine_power_hp,
    status,
    is_published,
    currency,
  } = data;

  const normalizedFeatures = normalizeFeatures(features);
  const normalizedImages = normalizeArrayMax10(images);

  const result = await db.query(
    `INSERT INTO car_listings (
      dealer_id, site_id,
      title, description, brand, model, trim, year, category,
      condition, mileage, exterior_color, interior_color,
      price, currency, fuel_type, transmission, engine_size, cylinders,
      drive_type,
      features, images,
      whatsapp_enabled, phone_enabled,
      importer, engine_power_hp,
      status, is_published
    )
    VALUES (
      $1,$2,
      $3,$4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,
      $14,$15,$16,$17,$18,$19,
      $20,
      $21::jsonb,$22::jsonb,
      $23,$24,
      $25,$26,
      $27,$28
    )
    RETURNING *`,
    [
      dealer_id,
      site_id,
      title,
      description || null,
      brand || null,
      model || null,
      trim || null,
      year || null,
      category || null,
      condition || null,
      mileage || null,
      exterior_color || null,
      interior_color || null,
      price || null,
      currency || 'SAR',
      fuel_type || null,
      transmission || null,
      engine_size || null,
      cylinders || null,
      drive_type || null,
      JSON.stringify(normalizedFeatures),
      JSON.stringify(normalizedImages),
      Boolean(whatsapp_enabled),
      Boolean(phone_enabled),
      importer || null,
      engine_power_hp || null,
      status || 'draft',
      Boolean(is_published),
    ]
  );

  return result.rows[0];
}

async function getCarsForSite({ dealer_id, site_id, page = 1, pageSize = 10 }) {
  const offset = (page - 1) * pageSize;

  const listRes = await db.query(
    `SELECT c.*
     FROM car_listings c
     WHERE c.dealer_id = $1 AND c.site_id = $2
     ORDER BY c.created_at DESC
     LIMIT $3 OFFSET $4`,
    [dealer_id, site_id, pageSize, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) AS total
     FROM car_listings
     WHERE dealer_id = $1 AND site_id = $2`,
    [dealer_id, site_id]
  );

  return {
    items: listRes.rows,
    total: Number(countRes.rows[0].total),
    page,
    pageSize,
  };
}

async function getCarById({ id, dealer_id, site_id }) {
  const result = await db.query(
    `SELECT *
     FROM car_listings
     WHERE id = $1 AND dealer_id = $2 AND site_id = $3
     LIMIT 1`,
    [id, dealer_id, site_id]
  );
  return result.rows[0] || null;
}

async function updateCarListing({ id, dealer_id, site_id, fields }) {
  const allowed = [
    'title','description','brand','model','trim','year',
    'category','condition','mileage','exterior_color','interior_color',
    'price','currency','fuel_type','transmission','engine_size','cylinders','drive_type',
    'features','images','whatsapp_enabled','phone_enabled',
    'importer','engine_power_hp','status','is_published',
  ];

  if (fields.features !== undefined) {
    fields.features = JSON.stringify(normalizeFeatures(fields.features));
  }
  if (fields.images !== undefined) {
    fields.images = JSON.stringify(normalizeArrayMax10(fields.images));
  }

  const setParts = [];
  const params = [];
  let idx = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      if (key === 'features' || key === 'images') {
        setParts.push(`${key} = $${idx++}::jsonb`);
      } else {
        setParts.push(`${key} = $${idx++}`);
      }
      params.push(fields[key]);
    }
  }

  if (!setParts.length) return null;

  params.push(id, dealer_id, site_id);

  const result = await db.query(
    `UPDATE car_listings
     SET ${setParts.join(', ')}, updated_at = NOW()
     WHERE id = $${idx++} AND dealer_id = $${idx++} AND site_id = $${idx}
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

async function deleteCarListing({ id, dealer_id, site_id }) {
  const result = await db.query(
    `DELETE FROM car_listings
     WHERE id = $1 AND dealer_id = $2 AND site_id = $3`,
    [id, dealer_id, site_id]
  );
  return result.rowCount > 0;
}

// ==========================
// Public (By site_id)
// ==========================
async function getFeaturedCarsForSite(site_id, { limit = 6 } = {}) {
  const res = await db.query(
    `SELECT c.*
     FROM car_listings c
     WHERE c.site_id = $1
       AND c.status = 'active'
       AND c.is_published = TRUE
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [site_id, limit]
  );
  return res.rows;
}

async function searchPublicCarsForSite(site_id, { page = 1, pageSize = 12 } = {}) {
  const p = Number(page) || 1;
  const ps = Number(pageSize) || 12;
  const offset = (p - 1) * ps;

  const listRes = await db.query(
    `SELECT c.*
     FROM car_listings c
     WHERE c.site_id = $1
       AND c.status = 'active'
       AND c.is_published = TRUE
     ORDER BY c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [site_id, ps, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) AS total
     FROM car_listings c
     WHERE c.site_id = $1
       AND c.status = 'active'
       AND c.is_published = TRUE`,
    [site_id]
  );

  return {
    items: listRes.rows,
    total: Number(countRes.rows[0].total),
    page: p,
    pageSize: ps,
  };
}

async function getPublicCarByIdForSite(site_id, carId) {
  const res = await db.query(
    `SELECT c.*
     FROM car_listings c
     WHERE c.id = $1
       AND c.site_id = $2
       AND c.status = 'active'
       AND c.is_published = TRUE
     LIMIT 1`,
    [carId, site_id]
  );
  return res.rows[0] || null;
}

module.exports = {
  // private
  createCarListing,
  getCarsForSite,
  getCarById,
  updateCarListing,
  deleteCarListing,

  // public
  getFeaturedCarsForSite,
  searchPublicCarsForSite,
  getPublicCarByIdForSite,
};
