// src/models/otp.model.js
const db = require('../config/db');

// توليد كود OTP عشوائي من 6 أرقام
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// إنشاء كود جديد وحفظه مع وقت انتهاء
async function createOtp(phone, code, expiresAt) {
  const result = await db.query(
    `INSERT INTO otp_codes (phone, code, expires_at, used)
     VALUES ($1, $2, $3, FALSE)
     RETURNING *`,
    [phone, code, expiresAt]
  );

  return result.rows[0];
}

// إيجاد كود صالح (غير مستخدم وضمن مدة الصلاحية)
async function findValidOtp(phone, code) {
  const result = await db.query(
    `SELECT *
     FROM otp_codes
     WHERE phone = $1
       AND code = $2
       AND used = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, code]
  );

  const row = result.rows[0];
  if (!row) return null;

  const now = new Date();
  const expiresAt = new Date(row.expires_at);
  if (expiresAt < now) {
    return null;
  }

  return row;
}

// تعليم الكود كـ مستخدم
async function markOtpUsed(id) {
  await db.query(
    `UPDATE otp_codes
     SET used = TRUE
     WHERE id = $1`,
    [id]
  );
}

// إلغاء (تعطيل) كل الأكواد القديمة لهذا الرقم
async function invalidateOldOtps(phone) {
  await db.query(
    `UPDATE otp_codes
     SET used = TRUE
     WHERE phone = $1
       AND used = FALSE`,
    [phone]
  );
}

/**
 * دوال قديمة/بديلة (لو بكرا استخدمتهم بمكان تاني)
 * saveOtpForPhone + verifyOtp
 * مبنية على نفس الجدول الحالي otp_codes
 */

// حفظ OTP بسرعة (بدون إرجاع سطر)
async function saveOtpForPhone(phone, code) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 دقائق

  await db.query(
    `INSERT INTO otp_codes (phone, code, expires_at, used)
     VALUES ($1, $2, $3, FALSE)`,
    [phone, code, expiresAt]
  );
}

// إيجاد OTP صالح (بدون فحص used يدوياً)
async function verifyOtp(phone, code) {
  const result = await db.query(
    `SELECT *
     FROM otp_codes
     WHERE phone = $1
       AND code = $2
       AND used = FALSE
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, code]
  );

  return result.rows[0] || null;
}

module.exports = {
  generateOtpCode,
  createOtp,
  findValidOtp,
  markOtpUsed,
  invalidateOldOtps,
  saveOtpForPhone,
  verifyOtp,
};
