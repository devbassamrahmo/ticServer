
const axios = require('axios');
const { randomUUID } = require('crypto');

const baseURL = process.env.NAFATH_BASE_URL;
const appId = process.env.NAFATH_APP_ID;
const appKey = process.env.NAFATH_APP_KEY;
console.log('NAFATH ENV CHECK', {
  baseURL: process.env.NAFATH_BASE_URL,
  hasAppId: !!process.env.NAFATH_APP_ID,
  hasAppKey: !!process.env.NAFATH_APP_KEY,
  appId: process.env.NAFATH_APP_ID,
  appKeyEnd: (process.env.NAFATH_APP_KEY || '').slice(-4),
});

function ensureEnv() {
  if (!baseURL) throw new Error('NAFATH_BASE_URL missing');
  if (!appId || !appKey) throw new Error('NAFATH_APP_ID / NAFATH_APP_KEY missing');
}

function headers() {
  return {
    'Content-Type': 'application/json;charset=utf-8',
    Accept: 'application/json',

    // 🔴 مهم جداً: lowercase فقط
    app_id: appId,
    app_key: appKey,
  };
}

function mapStatus(s) {
  if (s === 'COMPLETED') return 'verified';
  if (s === 'REJECTED') return 'rejected';
  if (s === 'EXPIRED') return 'expired';
  return 'pending';
}

async function startVerification({ nationalId, service, local = 'ar' }) {
  ensureEnv();
  const requestId = randomUUID();
  const h = headers();

  const res = await axios.post(
    `${baseURL}/api/v1/mfa/request`,
    { nationalId, service },
    {
      headers: h,
      params: {
        local,
        requestId,
        // ✅ ضيفهم كـ query كمان
        app_id: h.app_id,
        app_key: h.app_key,
      },
      timeout: 15000,
    }
  );

  return {
    requestId,
    transId: res.data.transId,
    random: res.data.random,
    raw: res.data,
  };
}


async function getVerificationStatus({ nationalId, transId, random }) {
  ensureEnv();
  const h = headers();

  const res = await axios.post(
    `${baseURL}/api/v1/mfa/request/status`,
    { nationalId, transId, random },
    {
      headers: h,
      params: {
        app_id: h.app_id,
        app_key: h.app_key,
      },
      timeout: 15000,
    }
  );

  return {
    status: mapStatus(res.data.status),
    nafathStatus: res.data.status,
    raw: res.data,
  };
}


module.exports = {
  startVerification,
  getVerificationStatus,
};
