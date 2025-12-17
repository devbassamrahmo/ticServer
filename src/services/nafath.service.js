// src/services/nafath.service.js
const axios = require('axios');
const { randomUUID } = require('crypto');

const baseURL = process.env.NAFATH_BASE_URL; // مثال: https://nafath-beta.api.elm.sa OR https://mock-service.api.elm.sa/nafath
const appId = process.env.NAFATH_APP_ID;
const appKey = process.env.NAFATH_APP_KEY;

const DEBUG = String(process.env.NAFATH_DEBUG || '').toLowerCase() === 'true';

function ensureEnv() {
  if (!baseURL) throw new Error('NAFATH_BASE_URL missing from env');
  if (!appId || !appKey) throw new Error('NAFATH_APP_ID/NAFATH_APP_KEY missing from env');
}

function headers() {
  ensureEnv();
  return {
    'Content-Type': 'application/json;charset=utf-8',

    // الأكثر شيوعاً
    'APP-ID': appId,
    'APP-KEY': appKey,

    // احتياط
    'app-id': appId,
    'app-key': appKey,
    'app_id': appId,
    'app_key': appKey,
  };
}

/**
 * بعض بيئات الـ mock-service بتتوقع auth كـ query params
 */
function authParams() {
  ensureEnv();
  return {
    appId,
    appKey,
    app_id: appId,
    app_key: appKey,
  };
}

function mapStatus(s) {
  if (s === 'COMPLETED') return 'verified';
  if (s === 'REJECTED') return 'rejected';
  if (s === 'EXPIRED') return 'expired';
  return 'pending'; // WAITING وغيره
}

function safeMask(str, keepEnd = 4) {
  if (!str) return str;
  const s = String(str);
  if (s.length <= keepEnd) return '*'.repeat(s.length);
  return '*'.repeat(s.length - keepEnd) + s.slice(-keepEnd);
}

// 1) Create MFA request
async function startVerification({ nationalId, service, local = 'ar' }) {
  ensureEnv();

  const requestId = randomUUID(); // Client request id (تبعك)
  const url = `${baseURL}/api/v1/mfa/request`;
  const body = { nationalId, service };

  const params = {
    local,
    requestId,
    ...authParams(), // ✅ مهم للمُحاكي
  };

  if (DEBUG) {
    console.log('NAFATH START →', {
      url,
      params: { ...params, appKey: safeMask(params.appKey) },
      body,
      headers: {
        'APP-ID': headers()['APP-ID'],
        'APP-KEY': safeMask(headers()['APP-KEY']),
      },
    });
  }

  const res = await axios.post(url, body, {
    headers: headers(),
    params,
    timeout: 15000,
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
  ensureEnv();

  const url = `${baseURL}/api/v1/mfa/request/status`;
  const body = { nationalId, transId, random };

  // ✅ بعض البيئات بدها auth params كمان هون
  const params = { ...authParams() };

  if (DEBUG) {
    console.log('NAFATH STATUS →', {
      url,
      params: { ...params, appKey: safeMask(params.appKey) },
      body,
    });
  }

  const res = await axios.post(url, body, {
    headers: headers(),
    params,
    timeout: 15000,
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
