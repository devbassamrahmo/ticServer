// src/services/nafath.service.js
const axios = require('axios');

const baseURL = process.env.NAFATH_BASE_URL;

function nafathHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-API-KEY': process.env.NAFATH_API_KEY, // أو حسب ما يعطوك
  };
}

// 1) إرسال طلب تحقق لنفاذ
// يرجع { requestId, randomCode, expiresAt, raw }
async function startVerification({ nationalId, channel = 'web' }) {
  // 🔴 ملاحظة: endpoint و body placeholders
  const res = await axios.post(
    `${baseURL}/verify`,           // استبدلها بالمسار الصحيح من الدوكيومنت
    {
      national_id: nationalId,
      channel,                     // web / mobile … حسب ما عندهم
      callback_url: process.env.NAFATH_CALLBACK_URL,
    },
    { headers: nafathHeaders() }
  );

  const data = res.data;

  // حسب الـ docs الفعلية، بس غالباً شي قريب من:
  return {
    requestId: data.request_id || data.trans_id,
    randomCode: data.random_number || data.code,  // الرقم اللي يظهر للمستخدم
    expiresAt: data.expires_at || null,
    raw: data,
  };
}

// 2) الاستعلام عن حالة طلب (polling من الفرونت)
async function getVerificationStatus(requestId) {
  const res = await axios.get(
    `${baseURL}/verify/${requestId}`,      // placeholder
    { headers: nafathHeaders() }
  );

  const data = res.data;

  // ماب لحالة موحدة
  let status = 'pending';
  if (data.status === 'VERIFIED' || data.status === 'approved') status = 'verified';
  else if (data.status === 'REJECTED') status = 'rejected';
  else if (data.status === 'EXPIRED') status = 'expired';

  return {
    status,
    raw: data,
  };
}

module.exports = {
  startVerification,
  getVerificationStatus,
};
