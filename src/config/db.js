// src/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),

  // ✅ إضافة آمنة: بتخلي db.connect شغّال للـ transactions
  connect: () => pool.connect(),

  // ✅ خليه متل ما هو حتى ما ينكسر أي مكان عم يستخدم db.pool
  pool,
};
