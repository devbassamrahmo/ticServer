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

const DEBUG = String(process.env.NAFATH_DEBUG || '').toLowerCase() === 'true';

/**
 * POST /api/auth/nafath/start
 * body: { national_id, service?, local? }
 */
exports.startLogin = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      national_id,
      service = process.env.NAFATH_SERVICE || 'sitec',
      local = process.env.NAFATH_LOCAL || 'ar',
    } = req.body;

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

    // نخزن transId كـ request_id (حسب تصميمك الحالي)
    const record = await createNafathLogin({
      user_id: userId,
      national_id,
      request_id: nafathRes.transId,
      channel: 'web',
      raw_response: {
        ...(nafathRes.raw || {}),
        clientRequestId: nafathRes.requestId, // UUID تبعك
        random: nafathRes.random,             // مهم للاستعلام لاحقاً
        service,
        local,
      },
    });

    return res.json({
      success: true,
      transId: nafathRes.transId,  // يستخدمه الفرونت
      random: nafathRes.random,    // يعرض للمستخدم
      record,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || null;

    console.error('nafath startLogin error:', data || err.message || err);

    // ✅ للتشخيص فقط (يتفعّل بـ NAFATH_DEBUG=true)
    const debugPayload = DEBUG
      ? {
          nafath_status: status,
          nafath_error: data,
          msg: err.message,
        }
      : undefined;

    return res.status(status === 500 ? 500 : status).json({
      success: false,
      message: 'فشل بدء تحقق نفاذ',
      ...(debugPayload ? debugPayload : {}),
    });
  }
};

/**
 * GET /api/auth/nafath/status/:requestId
 * requestId = transId (حسب تصميمك الحالي)
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

    // ✅ مهم: merge حتى ما يطير random / clientRequestId
    const mergedRaw = {
      ...(record.raw_response || {}),
      ...(nafathRes.raw || {}),
      lastStatusCheckAt: new Date().toISOString(),
    };

    const updated = await updateNafathStatusByRequestId(requestId, {
      status: nafathRes.status, // pending | verified | rejected | expired
      raw_response: mergedRaw,
    });

    if (nafathRes.status === 'verified') {
      await markUserNafathVerified(req.user.id, { national_id: record.national_id });

      // onboarding step
      try {
        await completeStep(req.user.id, 'nafath');
      } catch (_) {}
    }

    return res.json({
      success: true,
      nafathStatus: nafathRes.nafathStatus, // WAITING | COMPLETED | ...
      status: nafathRes.status,              // pending | verified | ...
      record: updated,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || null;

    console.error('nafath checkStatus error:', data || err.message || err);

    const debugPayload = DEBUG
      ? {
          nafath_status: status,
          nafath_error: data,
          msg: err.message,
        }
      : undefined;

    return res.status(status === 500 ? 500 : status).json({
      success: false,
      message: 'فشل الاستعلام عن حالة نفاذ',
      ...(debugPayload ? debugPayload : {}),
    });
  }
};

/**
 * Optional callback (noop حالياً)
 */
exports.callback = async (_req, res) => {
  return res.sendStatus(200);
};
