// src/services/nafath.service.js
const axios = require('axios');
const { randomUUID } = require('crypto');

const baseURL = process.env.NAFATH_BASE_URL; // مثال: https://nafath.api.elm.sa أو https://mock-service.api.elm.sa/nafath
const appId = process.env.NAFATH_APP_ID;
const appKey = process.env.NAFATH_APP_KEY;

function headers() {
  if (!appId || !appKey) {
    // خليها واضحة فوراً بدل ما تروح لنفاذ
    throw new Error('NAFATH_APP_ID/NAFATH_APP_KEY missing from env');
  }

  return {
    'Content-Type': 'application/json;charset=utf-8',

    // الصيغ اللي مذكورة بالـ docs كـ parameters
    'APP-ID': appId,
    'APP-KEY': appKey,

    // الصيغ اللي مذكورة بالـ securitySchemes
    'app_id': appId,
    'app_key': appKey,

    // احتياط (بعض السيرفرات بتعمل normalize)
    'app-id': appId,
    'app-key': appKey,
  };
}

function mapStatus(s) {
  if (s === 'COMPLETED') return 'verified';
  if (s === 'REJECTED') return 'rejected';
  if (s === 'EXPIRED') return 'expired';
  return 'pending'; // WAITING وغيره
}

// 1) Create MFA request
async function startVerification({ nationalId, service, local = 'ar' }) {
  const requestId = randomUUID(); // ✅ لازم يكون موجود

  const url = `${baseURL}/api/v1/mfa/request`;
  const body = { nationalId, service };
  const params = { local, requestId };

  // لو بدك ديباغ
  // console.log('NAFATH REQUEST', { url, params, body, appIdLen: (appId||'').length, appKeyLen: (appKey||'').length });
  console.log('NAFATH ENV CHECK →', {
  baseURL,
  appId: appId ? 'SET' : 'MISSING',
  appKey: appKey ? 'SET' : 'MISSING',
  appIdLen: appId?.length,
  appKeyLen: appKey?.length,
});
  const res = await axios.post(url, body, {
    headers: headers(),
    params,
  });

  const data = res.data || {};
  return {
    requestId,              // تبعك (للتتبع)
    transId: data.transId,  // تبع نفاذ
    random: data.random,    // رقم من خانتين
    raw: data,
  };
}

// 2) Check status
async function getVerificationStatus({ nationalId, transId, random }) {
  const url = `${baseURL}/api/v1/mfa/request/status`;
  const body = { nationalId, transId, random };

  const res = await axios.post(url, body, {
    headers: headers(),
  });

  const data = res.data || {};
  return {
    status: mapStatus(data.status),
    nafathStatus: data.status, // WAITING/COMPLETED...
    raw: data,
  };
}

module.exports = {
  startVerification,
  getVerificationStatus,
};
