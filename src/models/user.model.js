// src/models/user.model.js
const db = require('../config/db');

async function findUserByPhone(phone) {
  const result = await db.query(
    `SELECT
        id, phone, full_name, account_type, sector, company_name, email, city,
        COALESCE(is_admin, false) AS is_admin,
        COALESCE(nafath_verified,false) AS nafath_verified,
        COALESCE(real_estate_license_verified,false) AS real_estate_license_verified,
        COALESCE(car_license_verified,false) AS car_license_verified,

        cars_site_slug,
        realestate_site_slug,
        cars_site_template_key,
        realestate_site_template_key
     FROM users
     WHERE phone = $1
     LIMIT 1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function createUser(data) {
  const {
    phone,
    full_name,
    account_type,
    sector,
    company_name,
    email,
    city,
  } = data;

  const result = await db.query(
    `INSERT INTO users
      (phone, full_name, account_type, sector, company_name, email, city)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [phone, full_name, account_type, sector, company_name, email, city]
  );

  return result.rows[0];
}

async function findUserById(id) {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
}

async function updateUserProfile(id, fields) {
  const allowed = ['full_name', 'company_name', 'city', 'email', 'phone'];
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

  const result = await db.query(
    `UPDATE users
     SET ${setParts.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

async function setVerificationFlags(id, { nafath, realEstate, car }) {
  const setParts = [];
  const params = [];
  let idx = 1;

  if (nafath !== undefined) {
    setParts.push(`nafath_verified = $${idx++}`);
    params.push(nafath);
  }
  if (realEstate !== undefined) {
    setParts.push(`real_estate_license_verified = $${idx++}`);
    params.push(realEstate);
  }
  if (car !== undefined) {
    setParts.push(`car_license_verified = $${idx++}`);
    params.push(car);
  }

  if (!setParts.length) return null;

  params.push(id);

  const result = await db.query(
    `UPDATE users
     SET ${setParts.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
}

async function markUserNafathVerified(userId, { national_id } = {}) {
  const res = await db.query(
    `UPDATE users
     SET nafath_verified = TRUE,
         nafath_verified_at = NOW(),
         nafath_national_id = COALESCE($2, nafath_national_id),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, nafath_verified, nafath_verified_at, nafath_national_id`,
    [userId, national_id || null]
  );
  return res.rows[0] || null;
}

/**
 * ✅ تخزين slug + template_key حسب القطاع داخل users
 * sector: 'cars' | 'realestate'
 */
async function setUserSiteSlug(userId, sector, slug, template_key) {
  const slugCol = sector === 'cars' ? 'cars_site_slug' : 'realestate_site_slug';
  const templateCol =
    sector === 'cars' ? 'cars_site_template_key' : 'realestate_site_template_key';

  // template_key optional
  const res = await db.query(
    `UPDATE users
     SET ${slugCol} = $2,
         ${templateCol} = COALESCE($3, ${templateCol}),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, ${slugCol} AS site_slug, ${templateCol} AS site_template_key`,
    [userId, slug || null, template_key || null]
  );

  return res.rows[0] || null;
}

module.exports = {
  findUserByPhone,
  createUser,
  findUserById,
  updateUserProfile,
  setVerificationFlags,
  markUserNafathVerified,
  setUserSiteSlug,
};
