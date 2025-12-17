// src/services/nafath.service.js
const axios = require('axios');
const { randomUUID } = require('crypto');

const baseURL = process.env.NAFATH_BASE_URL; // https://nafath.api.elm.sa
const appId = process.env.NAFATH_APP_ID;
const appKey = process.env.NAFATH_APP_KEY;

function headers() {
  return {
    'Content-Type': 'application/json;charset=utf-8',
    'APP-ID': appId,
    'APP-KEY': appKey,
  };
}

// تحويل حالة نفاذ إلى حالة داخلية موحدة
function mapInternalStatus(nafathStatus) {
  if (nafathStatus === 'COMPLETED') return 'verified';
  if (nafathStatus === 'REJECTED') return 'rejected';
  if (nafathStatus === 'EXPIRED') return 'expired';
  return 'pending'; // WAITING
}

/**
 * 1) Create MFA request (نفاذ)
 */
async function startVerification({ nationalId, service, local = 'ar' }) {
  const clientRequestId = randomUUID(); // مطلوب بالـ query

  const res = await axios.post(
    `${baseURL}/api/v1/mfa/request`,
    {
      nationalId,
      service,
    },
    {
      headers: headers(),
      params: {
        local,
        requestId: clientRequestId,
      },
    }
  );

  const data = res.data || {};

  return {
    requestId: clientRequestId, // ID تبعك (للتتبع)
    transId: data.transId,      // ID تبع نفاذ
    random: data.random,        // رقم من خانتين
    raw: data,
  };
}

/**
 * 2) Check MFA request status
 */
async function getVerificationStatus({ nationalId, transId, random }) {
  const res = await axios.post(
    `${baseURL}/api/v1/mfa/request/status`,
    {
      nationalId,
      transId,
      random,
    },
    {
      headers: headers(),
    }
  );

  const data = res.data || {};

  return {
    nafathStatus: data.status,                 // WAITING | COMPLETED | ...
    status: mapInternalStatus(data.status),    // pending | verified | ...
    raw: data,
  };
}

module.exports = {
  startVerification,
  getVerificationStatus,
};
