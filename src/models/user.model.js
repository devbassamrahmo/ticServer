// src/models/user.model.js
const db = require('../config/db');

async function findUserByPhone(phone) {
  const result = await db.query(
    'SELECT * FROM users WHERE phone = $1 LIMIT 1',
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

module.exports = {
  findUserByPhone,
  createUser,
  findUserById,
  updateUserProfile,
  setVerificationFlags
};
