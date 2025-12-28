// src/models/listing.model.js
const db = require('../config/db');

function normalizeExtraData(extraData = {}) {
  const data = { ...extraData };

  // max 10 images
  if (Array.isArray(data.images)) data.images = data.images.slice(0, 10);
  else if (data.images == null) data.images = [];

  // features: Array
  if (!Array.isArray(data.features)) data.features = [];

  // project_info files normalization
  if (data.project_info && typeof data.project_info === 'object') {
    const p = data.project_info;
    p.is_project = Boolean(p.is_project);
    p.files = p.files || {};
    ['brochure', 'unit_plans', 'payment_plan', 'price_table'].forEach((k) => {
      if (p.files[k] != null && typeof p.files[k] !== 'string') {
        p.files[k] = String(p.files[k]);
      }
    });
  }

  // remove license keys (external API)
  ['ad_license_number','ad_license_issue_date','ad_license_expiry_date','site_ad_number','ad_source']
    .forEach((k) => { if (k in data) delete data[k]; });

  return data;
}

// ==========================
// Private (Dashboard)
// ==========================
async function createListing({
  dealer_id,
  site_id, // REQUIRED
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
}) {
  const normalizedData = normalizeExtraData(extraData || {});
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
      description || null,
      price,
      currency || 'SAR',
      status || 'draft',
      license_status || 'pending',
      city || null,
      category || null,
      is_published ?? false,
      normalizedData,
    ]
  );

  return result.rows[0];
}

async function getListingsForDealer({
  dealer_id,
  site_id,
  status,
  type,
  search,
  city,
  page = 1,
  pageSize = 10,
}) {
  const conditions = ['l.dealer_id = $1', 'l.site_id = $2'];
  const params = [dealer_id, site_id];
  let idx = 3;

  if (status) { conditions.push(`l.status = $${idx++}`); params.push(status); }
  if (type) { conditions.push(`l.type = $${idx++}`); params.push(type); }
  if (city) { conditions.push(`l.city ILIKE $${idx++}`); params.push(`%${city}%`); }
  if (search) {
    conditions.push(`(l.title ILIKE $${idx} OR l.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;

  const listRes = await db.query(
    `SELECT l.*
     FROM listings l
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, pageSize, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) AS total
     FROM listings l
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

async function updateListing(id, dealer_id, site_id, fields) {
  const allowedFields = [
    'title','description','price','currency',
    'status','license_status','city','category',
    'is_published','data',
  ];

  if (fields.data !== undefined) {
    fields.data = normalizeExtraData(fields.data || {});
  }

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

  params.push(id, dealer_id, site_id);

  const result = await db.query(
    `UPDATE listings
     SET ${setParts.join(', ')}, updated_at = NOW()
     WHERE id = $${idx++} AND dealer_id = $${idx++} AND site_id = $${idx}
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

async function deleteListing(id, dealer_id, site_id) {
  const result = await db.query(
    `DELETE FROM listings
     WHERE id = $1 AND dealer_id = $2 AND site_id = $3`,
    [id, dealer_id, site_id]
  );
  return result.rowCount > 0;
}

/* wrappers (private) */
const createPropertyListing = (data) => createListing({ ...data, type: 'property' });
const createProjectListing  = (data) => createListing({ ...data, type: 'project' });

const getPropertiesForDealer = (opts) => getListingsForDealer({ ...opts, type: 'property' });
const getProjectsForDealer  = (opts) => getListingsForDealer({ ...opts, type: 'project' });

async function updatePropertyListing(id, dealer_id, site_id, fields) {
  const updated = await updateListing(id, dealer_id, site_id, fields);
  if (!updated || updated.type !== 'property') return null;
  return updated;
}

async function updateProjectListing(id, dealer_id, site_id, fields) {
  const updated = await updateListing(id, dealer_id, site_id, fields);
  if (!updated || updated.type !== 'project') return null;
  return updated;
}

// ==========================
// Public (By site_id)
// ==========================
async function getFeaturedListingsForSite(site_id, { limit = 6 } = {}) {
  const result = await db.query(
    `SELECT l.*
     FROM listings l
     WHERE l.site_id = $1
       AND l.type IN ('property','project')
       AND l.status = 'active'
       AND l.is_featured = TRUE
       AND l.is_published = TRUE
     ORDER BY l.created_at DESC
     LIMIT $2`,
    [site_id, limit]
  );
  return result.rows;
}



async function getPublicListingByIdForSite(site_id, listingId) {
  const res = await db.query(
    `SELECT l.*
     FROM listings l
     WHERE l.id = $1
       AND l.site_id = $2
       AND l.type IN ('property','project')
       AND l.status = 'active'
       AND l.is_published = TRUE
     LIMIT 1`,
    [listingId, site_id]
  );
  return res.rows[0] || null;
}





async function getPropertyById(id, dealer_id) {
  const res = await db.query(
    `SELECT *
     FROM listings
     WHERE id = $1 AND dealer_id = $2 AND type = 'property'
     LIMIT 1`,
    [id, dealer_id]
  );
  return res.rows[0] || null;
}

async function getProjectById(id, dealer_id) {
  const res = await db.query(
    `SELECT *
     FROM listings
     WHERE id = $1 AND dealer_id = $2 AND type = 'project'
     LIMIT 1`,
    [id, dealer_id]
  );
  return res.rows[0] || null;
}

async function searchPublicListingsForSite(site_id, filters = {}, pagination = {}) {
  const page = Number(pagination.page || filters.page) || 1;
  const pageSize = Number(pagination.pageSize || filters.pageSize) || 12;
  const offset = (page - 1) * pageSize;

  const where = [
    `l.site_id = $1`,
    `l.status = 'active'`,
    `l.is_published = TRUE`,
    `l.type IN ('property','project')`,
  ];
  const params = [site_id];
  let idx = 2;

  const {
    type,       // property | project (اختياري)
    city,
    category,
    min_price,
    max_price,
    search,
  } = filters;

  if (type && ['property','project'].includes(type)) {
    where.push(`l.type = $${idx++}`);
    params.push(type);
  }

  if (city) {
    where.push(`l.city ILIKE $${idx++}`);
    params.push(`%${city}%`);
  }

  if (category) {
    where.push(`l.category = $${idx++}`);
    params.push(category);
  }

  if (min_price) { where.push(`l.price >= $${idx++}`); params.push(Number(min_price)); }
  if (max_price) { where.push(`l.price <= $${idx++}`); params.push(Number(max_price)); }

  if (search) {
    where.push(`(l.title ILIKE $${idx} OR l.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  const listRes = await db.query(
    `SELECT l.*
     FROM listings l
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, pageSize, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) AS total
     FROM listings l
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

async function getSimilarListingForSite(site_id, listingId, { limit = 4 } = {}) {
  // 1) base listing
  const baseRes = await db.query(
    `SELECT * FROM listings
     WHERE id = $1 AND site_id = $2
       AND status = 'active' AND is_published = TRUE
       AND type IN ('property','project')
     LIMIT 1`,
    [listingId, site_id]
  );
  const base = baseRes.rows[0];
  if (!base) return [];

  const minP = base.price ? Math.floor(Number(base.price) * 0.8) : null;
  const maxP = base.price ? Math.ceil(Number(base.price) * 1.2) : null;

  const where = [
    `l.site_id = $1`,
    `l.id <> $2`,
    `l.status = 'active'`,
    `l.is_published = TRUE`,
    `l.type = $3`,
  ];
  const params = [site_id, listingId, base.type];
  let idx = 4;

  if (base.city) { where.push(`l.city = $${idx++}`); params.push(base.city); }
  if (base.category) { where.push(`l.category = $${idx++}`); params.push(base.category); }

  if (minP !== null && maxP !== null) {
    where.push(`l.price BETWEEN $${idx++} AND $${idx++}`);
    params.push(minP, maxP);
  }

  const res = await db.query(
    `SELECT l.*
     FROM listings l
     WHERE ${where.join(' AND ')}
     ORDER BY l.created_at DESC
     LIMIT $${idx++}`,
    [...params, limit]
  );

  // fallback: نفس النوع فقط
  if (!res.rows.length) {
    const fallback = await db.query(
      `SELECT l.*
       FROM listings l
       WHERE l.site_id = $1
         AND l.id <> $2
         AND l.status = 'active'
         AND l.is_published = TRUE
         AND l.type = $3
       ORDER BY l.created_at DESC
       LIMIT $4`,
      [site_id, listingId, base.type, limit]
    );
    return fallback.rows;
  }

  return res.rows;
}

module.exports = {
  // private
  createPropertyListing,
  createProjectListing,
  getPropertiesForDealer,
  getProjectsForDealer,
  updatePropertyListing,
  updateProjectListing,
  deleteListing,
  
  // public by site_id
  getFeaturedListingsForSite,
  searchPublicListingsForSite,
  getPublicListingByIdForSite,
  getSimilarListingForSite,

  getPropertyById,
  getProjectById,
};
