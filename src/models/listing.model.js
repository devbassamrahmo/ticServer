// src/models/listing.model.js
const db = require('../config/db');
// helper لتقصير عدد الصور وتنظيف الداتا
function normalizeExtraData(extraData = {}) {
  const data = { ...extraData };

  // 1) حد أقصى 10 صور/فيديو
  if (Array.isArray(data.images)) {
    data.images = data.images.slice(0, 10);
  } else if (data.images == null) {
    data.images = [];
  }

  // 2) المميزات لازم تكون Array
  if (!Array.isArray(data.features)) {
    data.features = Array.isArray(data.features) ? data.features : [];
  }

  // 3) project_info.files موجودة بس للمشاريع
  if (data.project_info && typeof data.project_info === 'object') {
    const p = data.project_info;
    p.is_project = Boolean(p.is_project);

    p.files = p.files || {};
    const filesKeys = ['brochure', 'unit_plans', 'payment_plan', 'price_table'];
    filesKeys.forEach((k) => {
      if (p.files[k] != null && typeof p.files[k] !== 'string') {
        p.files[k] = String(p.files[k]);
      }
    });
  }

  // 4) ما نخزن معلومات رخصة الإعلان (بتنجيب من API ثاني)
  const licenseKeys = [
    'ad_license_number',
    'ad_license_issue_date',
    'ad_license_expiry_date',
    'site_ad_number',
    'ad_source',
  ];
  licenseKeys.forEach((k) => {
    if (k in data) delete data[k];
  });

  return data;
}
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
      site_id || null,          // 👈 هون المهم: لو بعت 1 أو undefined بيصير NULL
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
      normalizedData,
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

async function updateListing(id, dealer_id, fields) {
  const allowedFields = [
    'title',
    'description',
    'price',
    'currency',
    'status',
    'license_status',
    'city',
    'category',
    'is_published',
    'data',
  ];

  const setParts = [];
  const params = [];
  let idx = 1;

  // إذا في تعديل لـ data نطبّق normalizeExtraData
  if (fields.data !== undefined) {
    fields.data = normalizeExtraData(fields.data || {});
  }

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

async function getFeaturedListingsForDealer(dealerId, { limit = 6 }) {
  const result = await db.query(
    `SELECT
       l.*,
       COALESCE(SUM(CASE WHEN e.event_type = 'view' THEN 1 END), 0) AS views,
       COALESCE(SUM(CASE WHEN e.event_type IN ('whatsapp_click','call_click') THEN 1 END), 0) AS contacts
     FROM listings l
     LEFT JOIN listing_events e ON e.listing_id = l.id
     WHERE l.dealer_id = $1
       AND l.status = 'active'
       AND l.is_featured = TRUE
     GROUP BY l.id
     ORDER BY l.created_at DESC
     LIMIT $2`,
    [dealerId, limit]
  );

  return result.rows;
}



// البحث العام (public search) لإعلانات معرض معيّن
async function searchPublicListings(dealerId, filters = {}, pagination = {}) {
  const {
    city,
    district,
    purpose,          // "buy" | "rent"  -> إذا عندك حقل purpose
    property_type,    // شقة, فيلا, أرض...
    min_rooms,
    max_rooms,
    min_area,
    max_area,
    min_price,
    max_price,
    min_age,
    max_age,
  } = filters;

  const page = Number(pagination.page) || 1;
  const pageSize = Number(pagination.pageSize) || 12;
  const offset = (page - 1) * pageSize;

  const whereParts = [
    'l.dealer_id = $1',
    "l.status = 'active'",
  ];
  const params = [dealerId];
  let idx = params.length + 1;

  function addFilter(condition, value) {
    if (value !== undefined && value !== null && value !== '') {
      whereParts.push(condition.replace(/\?/g, `$${idx++}`));
      params.push(value);
    }
  }

  if (city) addFilter('l.city = ?', city);
  if (district) addFilter('l.district = ?', district);
  if (purpose) addFilter('l.purpose = ?', purpose);
  if (property_type) addFilter('l.property_type = ?', property_type);

  if (min_rooms) addFilter('l.rooms >= ?', Number(min_rooms));
  if (max_rooms) addFilter('l.rooms <= ?', Number(max_rooms));

  if (min_area) addFilter('l.area >= ?', Number(min_area));
  if (max_area) addFilter('l.area <= ?', Number(max_area));

  if (min_price) addFilter('l.price >= ?', Number(min_price));
  if (max_price) addFilter('l.price <= ?', Number(max_price));

  if (min_age) addFilter('l.age_years >= ?', Number(min_age));
  if (max_age) addFilter('l.age_years <= ?', Number(max_age));

  const whereClause = whereParts.join(' AND ');

  // query القائمة
  const listQuery = `
    SELECT
      l.*,
      COALESCE(SUM(CASE WHEN e.event_type = 'view' THEN 1 END), 0) AS views,
      COALESCE(SUM(CASE WHEN e.event_type IN ('whatsapp_click','call_click') THEN 1 END), 0) AS contacts
    FROM listings l
    LEFT JOIN listing_events e ON e.listing_id = l.id
    WHERE ${whereClause}
    GROUP BY l.id
    ORDER BY l.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  // query العدد الكلي
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM listings l
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

// إعلان واحد (public) ومتأكدين إنه تابع لهالمعرض و active
async function getPublicListingById(dealerId, listingId) {
  const res = await db.query(
    `SELECT
       l.*,
       COALESCE(SUM(CASE WHEN e.event_type = 'view' THEN 1 END), 0) AS views,
       COALESCE(SUM(CASE WHEN e.event_type IN ('whatsapp_click','call_click') THEN 1 END), 0) AS contacts
     FROM listings l
     LEFT JOIN listing_events e ON e.listing_id = l.id
     WHERE l.id = $1
       AND l.dealer_id = $2
       AND l.status = 'active'
     GROUP BY l.id
     LIMIT 1`,
    [listingId, dealerId]
  );

  return res.rows[0] || null;
}

module.exports = {
  createListing,
  getListingsForDealer,
  updateListing,
  deleteListing,
  getFeaturedListingsForDealer,
  searchPublicListings,
  getPublicListingById
};
