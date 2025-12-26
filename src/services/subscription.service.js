// src/services/subscription.service.js
const db = require('../config/db');

/**
 * عدّلها حسب مشروعك:
 * - تفعيل plan
 * - تسجيل اشتراك
 */
async function activateUserSubscription({ userId, paymentId, meta }) {
  // مثال 1: تحديث user مباشرة
  await db.query(
    `UPDATE users
     SET plan = COALESCE($2, 'pro'), plan_active = true, plan_updated_at = NOW()
     WHERE id = $1`,
    [userId, meta?.plan || 'pro']
  );

  // مثال 2 (اختياري): جدول اشتراكات
  // لازم يكون عندك جدول subscriptions + unique(payment_id) أو unique(user_id,status) حسب تصميمك
  // await db.query(
  //   `INSERT INTO subscriptions (user_id, payment_id, status, started_at)
  //    VALUES ($1, $2, 'active', NOW())
  //    ON CONFLICT DO NOTHING`,
  //   [userId, paymentId]
  // );
}

module.exports = { activateUserSubscription };
