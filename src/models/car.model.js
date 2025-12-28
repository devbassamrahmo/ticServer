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

async function getCarsForSite({ dealer_id, site_id, page = 1, pageSize = 10, q }) {
  const offset = (page - 1) * pageSize;

  const where = [`c.dealer_id = $1`, `c.site_id = $2`];
  const params = [dealer_id, site_id];
  let idx = 3;

  if (q) {
    where.push(`(
      c.title ILIKE $${idx}
      OR c.brand ILIKE $${idx}
      OR c.model ILIKE $${idx}
      OR c.trim ILIKE $${idx}
    )`);
    params.push(`%${q}%`);
    idx++;
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  const listRes = await db.query(
    `SELECT c.*
     FROM car_listings c
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, pageSize, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) AS total
     FROM car_listings c
     ${whereClause}`,
    params
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

async function searchPublicCarsForSite(site_id, filters = {}, pagination = {}) {
  const page = Number(pagination.page || filters.page) || 1;
  const pageSize = Number(pagination.pageSize || filters.pageSize) || 12;
  const offset = (page - 1) * pageSize;

  const where = [
    `c.site_id = $1`,
    `c.status = 'active'`,
    `c.is_published = TRUE`,
  ];
  const params = [site_id];
  let idx = 2;

  const {
    brand,
    model,
    condition,
    category,
    transmission,
    fuel_type,
    drive_type,
    min_price,
    max_price,
    min_year,
    max_year,
    search,
  } = filters;

  if (brand) { where.push(`c.brand ILIKE $${idx++}`); params.push(`%${brand}%`); }
  if (model) { where.push(`c.model ILIKE $${idx++}`); params.push(`%${model}%`); }
  if (condition) { where.push(`c.condition = $${idx++}`); params.push(condition); }
  if (category) { where.push(`c.category = $${idx++}`); params.push(category); }
  if (transmission) { where.push(`c.transmission = $${idx++}`); params.push(transmission); }
  if (fuel_type) { where.push(`c.fuel_type = $${idx++}`); params.push(fuel_type); }
  if (drive_type) { where.push(`c.drive_type = $${idx++}`); params.push(drive_type); }

  if (min_price) { where.push(`c.price >= $${idx++}`); params.push(Number(min_price)); }
  if (max_price) { where.push(`c.price <= $${idx++}`); params.push(Number(max_price)); }
  if (min_year) { where.push(`c.year >= $${idx++}`); params.push(Number(min_year)); }
  if (max_year) { where.push(`c.year <= $${idx++}`); params.push(Number(max_year)); }

  if (search) {
    where.push(`(c.title ILIKE $${idx} OR c.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  const listRes = await db.query(
    `SELECT c.*
     FROM car_listings c
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, pageSize, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) AS total
     FROM car_listings c
     ${whereClause}`,
    params
  );

  return {
    items: listRes.rows,
    total: Number(countRes.rows[0].total),
    page,
    pageSize,
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

async function getSimilarCarsForSite(site_id, carId, { limit = 4 } = {}) {
  // 1) جيب السيارة الأساسية
  const baseRes = await db.query(
    `SELECT * FROM car_listings
     WHERE id = $1 AND site_id = $2
       AND status = 'active' AND is_published = TRUE
     LIMIT 1`,
    [carId, site_id]
  );

  const base = baseRes.rows[0];
  if (!base) return [];

  // 2) تشابه: نفس brand/model قدر الإمكان + قرب بالسعر/السنة
  // price window: +/- 20%
  const minP = base.price ? Math.floor(Number(base.price) * 0.8) : null;
  const maxP = base.price ? Math.ceil(Number(base.price) * 1.2) : null;

  const params = [site_id, carId];
  let idx = 3;

  const where = [
    `c.site_id = $1`,
    `c.id <> $2`,
    `c.status = 'active'`,
    `c.is_published = TRUE`,
  ];

  if (base.brand) { where.push(`c.brand = $${idx++}`); params.push(base.brand); }
  if (base.model) { where.push(`c.model = $${idx++}`); params.push(base.model); }
  if (base.condition) { where.push(`c.condition = $${idx++}`); params.push(base.condition); }

  if (minP !== null && maxP !== null) {
    where.push(`c.price BETWEEN $${idx++} AND $${idx++}`);
    params.push(minP, maxP);
  }

  // year window +/- 2
  if (base.year) {
    where.push(`c.year BETWEEN $${idx++} AND $${idx++}`);
    params.push(Number(base.year) - 2, Number(base.year) + 2);
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  const res = await db.query(
    `SELECT c.*
     FROM car_listings c
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${idx++}`,
    [...params, limit]
  );

  // fallback لو ما رجع شي (مثلاً model فاضي) -> نفس brand بس
  if (!res.rows.length && base.brand) {
    const fallback = await db.query(
      `SELECT c.*
       FROM car_listings c
       WHERE c.site_id = $1
         AND c.id <> $2
         AND c.status = 'active'
         AND c.is_published = TRUE
         AND c.brand = $3
       ORDER BY c.created_at DESC
       LIMIT $4`,
      [site_id, carId, base.brand, limit]
    );
    return fallback.rows;
  }

  return res.rows;
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
  getSimilarCarsForSite
};
