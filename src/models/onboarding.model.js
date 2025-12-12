// src/models/onboarding.model.js
const db = require('../config/db');

const DEFAULT_STEPS = [
  { step_key: 'nafath',       step_order: 1 },
  { step_key: 'faal_license', step_order: 2 },
  { step_key: 'basic_info',   step_order: 3 },
  { step_key: 'site_setup',   step_order: 4 },
  { step_key: 'first_listing',step_order: 5 },
  { step_key: 'plan',         step_order: 6 },
  { step_key: 'publish_site', step_order: 7 },
];

// إنشاء خطوات الـ onboarding لأول مرة لمستخدم جديد
async function initOnboardingForUser(userId) {
  const values = [];
  const params = [];
  let idx = 1;

  DEFAULT_STEPS.forEach((s, i) => {
    const status = i === 0 ? 'current' : 'pending';
    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    params.push(userId, s.step_key, s.step_order, status);
  });

  const query = `
    INSERT INTO onboarding_steps (user_id, step_key, step_order, status)
    VALUES ${values.join(', ')}
  `;

  await db.query(query, params);
}

// جلب خطوات المستخدم
async function getOnboardingForUser(userId) {
  const result = await db.query(
    `SELECT id, step_key, step_order, status, completed_at
     FROM onboarding_steps
     WHERE user_id = $1
     ORDER BY step_order ASC`,
    [userId]
  );
  return result.rows;
}

// تعليم خطوة كمكتملة وتحريك اللي بعدها لـ current
async function completeStep(userId, stepKey) {
  // نجيب الخطوة الحالية
  const res = await db.query(
    `SELECT *
     FROM onboarding_steps
     WHERE user_id = $1 AND step_key = $2
     LIMIT 1`,
    [userId, stepKey]
  );

  const step = res.rows[0];
  if (!step) return null;

  // لو كانت Done رجع كل الخطوات كمان، حتى يكون الـ shape ثابت
  if (step.status === 'done') {
    const all = await getOnboardingForUser(userId);
    return all;
  }

  // نعلّمها done
  await db.query(
    `UPDATE onboarding_steps
     SET status = 'done', completed_at = NOW()
     WHERE id = $1`,
    [step.id]
  );

  // نجيب أول خطوة بعدها لسا pending
  const nextRes = await db.query(
    `SELECT *
     FROM onboarding_steps
     WHERE user_id = $1
       AND step_order > $2
       AND status = 'pending'
     ORDER BY step_order ASC
     LIMIT 1`,
    [userId, step.step_order]
  );

  const next = nextRes.rows[0];

  if (next) {
    await db.query(
      `UPDATE onboarding_steps
       SET status = 'current'
       WHERE id = $1`,
      [next.id]
    );
  }

  const all = await getOnboardingForUser(userId);
  return all;
}

module.exports = {
  initOnboardingForUser,
  getOnboardingForUser,
  completeStep,
};
