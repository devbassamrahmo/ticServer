// src/controllers/nafath.controller.js
const {
  startVerification,
  getVerificationStatus,
} = require('../services/nafath.service');

const {
  createNafathLogin,
  updateNafathStatusByRequestId,
  findByRequestId,
} = require('../models/nafath.model');

// POST /api/auth/nafath/start
// body: { national_id }
exports.startLogin = async (req, res) => {
  try {
    const userId = req.user.id; // مسجّل دخول عندك
    const { national_id } = req.body;

    if (!national_id) {
      return res.status(400).json({
        success: false,
        message: 'national_id مطلوب',
      });
    }

    // نطلب من نفاذ بدء التحقق
    const nafathRes = await startVerification({
      nationalId: national_id,
      channel: 'web',
    });

    // نخزن المحاولة في DB
    const record = await createNafathLogin({
      user_id: userId,
      national_id,
      request_id: nafathRes.requestId,
      channel: 'web',
      raw_response: nafathRes.raw,
    });

    return res.json({
      success: true,
      requestId: nafathRes.requestId,
      code: nafathRes.randomCode,    // هاد الرقم بتعرضو للمستخدم
      expiresAt: nafathRes.expiresAt,
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

// GET /api/auth/nafath/status/:requestId
exports.checkStatus = async (req, res) => {
  try {
    const { requestId } = req.params;

    const nafathRes = await getVerificationStatus(requestId);

    // نحدّث الداتابيس
    const updated = await updateNafathStatusByRequestId(requestId, {
      status: nafathRes.status,
      raw_response: nafathRes.raw,
    });

    return res.json({
      success: true,
      status: nafathRes.status,
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

// POST /api/auth/nafath/callback
// هاد ال endpoint رح تحطه عند نفاذ كـ callback URL
exports.callback = async (req, res) => {
  try {
    const payload = req.body;
    console.log('Nafath callback payload:', payload);

    const requestId = payload.request_id || payload.trans_id;
    if (!requestId) return res.sendStatus(400);

    // ماب لحالة موحدة
    let status = 'pending';
    if (payload.status === 'VERIFIED' || payload.status === 'approved') status = 'verified';
    else if (payload.status === 'REJECTED') status = 'rejected';
    else if (payload.status === 'EXPIRED') status = 'expired';

    const updated = await updateNafathStatusByRequestId(requestId, {
      status,
      raw_response: payload,
    });

    // TODO: لو verified:
    // - علم حقل user.is_verified_by_nafath = true
    // - فعل مميزات معينة بالحساب

    return res.sendStatus(200);
  } catch (err) {
    console.error('nafath callback error:', err);
    return res.sendStatus(500);
  }
};
