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

function getAuthedUserId(req) {
  // دعم أكثر من شكل حسب middleware تبعك
  return req.user?.id || req.user?.user_id || req.userId || req.user_id || null;
}

/**
 * POST /api/auth/nafath/start
 * body: { national_id, service?, local? }
 */
exports.startLogin = async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: missing user context (token required)',
      });
    }

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

    const record = await createNafathLogin({
      user_id: userId,
      national_id,
      request_id: nafathRes.transId, // (تصميمك الحالي)
      channel: 'web',
      raw_response: {
        ...(nafathRes.raw || {}),
        clientRequestId: nafathRes.requestId,
        random: nafathRes.random,
        service,
        local,
      },
    });

    return res.json({
      success: true,
      transId: nafathRes.transId,
      random: nafathRes.random,
      record,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || null;

    console.error('nafath startLogin error:', data || err.message || err);

    return res.status(500).json({
      success: false,
      message: 'فشل بدء تحقق نفاذ',
      ...(DEBUG
        ? { nafath_status: status, nafath_error: data, msg: err.message }
        : {}),
    });
  }
};

/**
 * GET /api/auth/nafath/status/:requestId
 */
exports.checkStatus = async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: missing user context (token required)',
      });
    }

    const { requestId } = req.params;

    const record = await findByRequestId(requestId);
    if (!record || record.user_id !== userId) {
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

    const mergedRaw = {
      ...(record.raw_response || {}),
      ...(nafathRes.raw || {}),
      lastStatusCheckAt: new Date().toISOString(),
    };

    const updated = await updateNafathStatusByRequestId(requestId, {
      status: nafathRes.status,
      raw_response: mergedRaw,
    });

    if (nafathRes.status === 'verified') {
      await markUserNafathVerified(userId, { national_id: record.national_id });
      try { await completeStep(userId, 'nafath'); } catch (_) {}
    }

    return res.json({
      success: true,
      nafathStatus: nafathRes.nafathStatus,
      status: nafathRes.status,
      record: updated,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || null;

    console.error('nafath checkStatus error:', data || err.message || err);

    return res.status(500).json({
      success: false,
      message: 'فشل الاستعلام عن حالة نفاذ',
      ...(DEBUG
        ? { nafath_status: status, nafath_error: data, msg: err.message }
        : {}),
    });
  }
};

exports.callback = async (_req, res) => res.sendStatus(200);
