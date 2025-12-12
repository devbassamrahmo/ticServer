const db = require('../config/db');

async function createCarListing(dealerId, data) {
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
    cylinders,
    features,
    images,
    whatsapp_enabled,
    phone_enabled,
    importer,
    engine_power_hp
  } = data;

  // Normalize Arrays
  const normalizedFeatures = Array.isArray(features) ? features : [];
  const normalizedImages = Array.isArray(images) ? images.slice(0, 10) : [];

  // Convert to JSON strings (Postgres JSONB compatible)
  const featuresJson = JSON.stringify(normalizedFeatures);
  const imagesJson = JSON.stringify(normalizedImages);

  const result = await db.query(
    `INSERT INTO car_listings (
      dealer_id, title, description, brand, model, trim, year, category,
      condition, mileage, exterior_color, interior_color,
      price, fuel_type, transmission, engine_size, cylinders,
      features, images, whatsapp_enabled, phone_enabled, importer, engine_power_hp
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      $9,$10,$11,$12,
      $13,$14,$15,$16,$17,
      $18,$19,$20,$21,$22,$23
    )
    RETURNING *`,
    [
      dealerId, title, description, brand, model, trim, year, category,
      condition, mileage, exterior_color, interior_color,
      price, fuel_type, transmission, engine_size, cylinders,
      featuresJson, imagesJson, whatsapp_enabled, phone_enabled,
      importer, engine_power_hp
    ]
  );

  return result.rows[0];
}

async function getCars(dealerId, { page = 1, pageSize = 10 }) {
  const offset = (page - 1) * pageSize;

  const listQuery = `
    SELECT
      c.*,
      COALESCE(SUM(CASE WHEN e.event_type = 'view' THEN 1 END), 0) AS views,
      COALESCE(SUM(CASE WHEN e.event_type IN ('whatsapp_click', 'call_click') THEN 1 END), 0) AS contacts
    FROM car_listings c
    LEFT JOIN listing_events e ON e.listing_id = c.id
    WHERE c.dealer_id = $1
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM car_listings
    WHERE dealer_id = $1
  `;

  const [listRes, countRes] = await Promise.all([
    db.query(listQuery, [dealerId]),
    db.query(countQuery, [dealerId])
  ]);

  return {
    items: listRes.rows,
    total: Number(countRes.rows[0].total),
    page,
    pageSize
  };
}

async function getCarById(id, dealerId) {
  const result = await db.query(
    `SELECT * FROM car_listings
     WHERE id = $1 AND dealer_id = $2`,
    [id, dealerId]
  );
  return result.rows[0];
}

async function updateCarListing(id, dealerId, fields) {
  const allowed = [
    'title','description','brand','model','trim','year',
    'category','condition','mileage','exterior_color',
    'interior_color','price','fuel_type','transmission',
    'engine_size','cylinders','features','images',
    'whatsapp_enabled','phone_enabled','status',
    'importer','engine_power_hp'
  ];

  const setParts = [];
  const params = [];
  let idx = 1;

  // Normalize features
  if (fields.features !== undefined) {
    if (!Array.isArray(fields.features)) {
      fields.features = [];
    }
    fields.features = JSON.stringify(fields.features);
  }

  // Normalize images (max 10)
  if (fields.images !== undefined) {
    if (Array.isArray(fields.images)) {
      fields.images = JSON.stringify(fields.images.slice(0, 10));
    } else {
      fields.images = JSON.stringify([]);
    }
  }

  // Build dynamic update query
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      setParts.push(`${key} = $${idx++}`);
      params.push(fields[key]);
    }
  }

  if (!setParts.length) return null;

  params.push(id);
  params.push(dealerId);

  const result = await db.query(
    `UPDATE car_listings
     SET ${setParts.join(', ')}, updated_at = NOW()
     WHERE id = $${idx++} AND dealer_id = $${idx}
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

async function deleteCarListing(id, dealerId) {
  const result = await db.query(
    `DELETE FROM car_listings
     WHERE id = $1 AND dealer_id = $2`,
    [id, dealerId]
  );

  return result.rowCount > 0;
}

module.exports = {
  createCarListing,
  getCars,
  getCarById,
  updateCarListing,
  deleteCarListing
};
