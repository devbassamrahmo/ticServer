// src/controllers/nafath.controller.js
const {
  startVerification,
  getVerificationStatus,
} = require('../services/nafath.service');
const { markUserNafathVerified } = require('../models/user.model');
const {
  createNafathLogin,
  updateNafathStatusByRequestId,
  findByRequestId,
} = require('../models/nafath.model');
const { completeStep } = require('../models/onboarding.model');

/**
 * POST /api/auth/nafath/start
 * body: { national_id, service?, local? }
 */
exports.startLogin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { national_id, service = 'sitec', local = 'ar' } = req.body;

    if (!national_id) {
      return res.status(400).json({
        success: false,
        message: 'national_id مطلوب',
      });
    }

    const nafathRes = await startVerification({
      nationalId: national_id,
      service,
      local,
    });

    // نخزن transId كنقطة مرجعية أساسية
    const record = await createNafathLogin({
      user_id: userId,
      national_id,
      request_id: nafathRes.transId,
      channel: 'web',
      raw_response: {
        ...nafathRes.raw,
        clientRequestId: nafathRes.requestId,
        random: nafathRes.random,
      },
    });

    return res.json({
      success: true,
      transId: nafathRes.transId,   // يستخدمه الفرونت
      random: nafathRes.random,     // يعرض للمستخدم
      record,
    });
  } catch (err) {
    console.error('nafath startLogin error:', err.response?.data || err);
    return res.status(500).json({
      success: false,
      message: 'فشل بدء تحقق نفاذ',
    });
  }
};

/**
 * GET /api/auth/nafath/status/:requestId
 * requestId = transId
 */
exports.checkStatus = async (req, res) => {
  try {
    const { requestId } = req.params;

    const record = await findByRequestId(requestId);
    if (!record || record.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح',
      });
    }

    const random = record.raw_response?.random;
    if (!random) {
      return res.status(400).json({
        success: false,
        message: 'random غير موجود لهذا الطلب',
      });
    }

    const nafathRes = await getVerificationStatus({
      nationalId: record.national_id,
      transId: requestId,
      random,
    });

    const updated = await updateNafathStatusByRequestId(requestId, {
      status: nafathRes.status, // pending | verified | ...
      raw_response: nafathRes.raw,
    });
        if (nafathRes.status === 'verified') {
      await markUserNafathVerified(req.user.id, { national_id: record.national_id });

      // onboarding step
      try { await completeStep(req.user.id, 'nafath'); } catch (_) {}
    }
    return res.json({
      success: true,
      nafathStatus: nafathRes.nafathStatus, // WAITING | COMPLETED | ...
      status: nafathRes.status,              // pending | verified | ...
      record: updated,
    });
  } catch (err) {
    console.error('nafath checkStatus error:', err.response?.data || err);
    return res.status(500).json({
      success: false,
      message: 'فشل الاستعلام عن حالة نفاذ',
    });
  }
};

/**
 * Optional callback (noop حالياً)
 */
exports.callback = async (_req, res) => {
  return res.sendStatus(200);
};
