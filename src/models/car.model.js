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
    mileage_unit,
    exterior_color,
    interior_color,
    price,
    currency,
    fuel_type,
    transmission,
    engine_size,
    cylinders,
    features,
    images,
    whatsapp_enabled,
    phone_enabled
  } = data;

  const result = await db.query(
    `INSERT INTO car_listings (
      dealer_id, title, description, brand, model, trim, year, category,
      condition, mileage, mileage_unit, exterior_color, interior_color,
      price, currency, fuel_type, transmission, engine_size, cylinders,
      features, images, whatsapp_enabled, phone_enabled
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      $9,$10,$11,$12,$13,
      $14,$15,$16,$17,$18,$19,
      $20,$21,$22,$23
    )
    RETURNING *`,
    [
      dealerId, title, description, brand, model, trim, year, category,
      condition, mileage, mileage_unit, exterior_color, interior_color,
      price, currency, fuel_type, transmission, engine_size, cylinders,
      features || [], images || [], whatsapp_enabled, phone_enabled
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
    'category','condition','mileage','mileage_unit','exterior_color',
    'interior_color','price','currency','fuel_type','transmission',
    'engine_size','cylinders','features','images',
    'whatsapp_enabled','phone_enabled','status'
  ];

  const setParts = [];
  const params = [];
  let idx = 1;

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
