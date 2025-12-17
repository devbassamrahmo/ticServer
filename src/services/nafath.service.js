// src/services/nafath.service.js
const axios = require('axios');
const { randomUUID } = require('crypto');

function stripQuotes(v) {
  if (!v) return v;
  const s = String(v).trim();
  // يشيل "..." أو '...'
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

const baseURL = stripQuotes(process.env.NAFATH_BASE_URL);
const appId = stripQuotes(process.env.NAFATH_APP_ID);
const appKey = stripQuotes(process.env.NAFATH_APP_KEY);

const DEBUG = String(process.env.NAFATH_DEBUG || '').toLowerCase() === 'true';

function ensureEnv() {
  if (!baseURL) throw new Error('NAFATH_BASE_URL missing from env');
  if (!appId || !appKey) throw new Error('NAFATH_APP_ID/NAFATH_APP_KEY missing from env');
}

function safeMask(str, keepEnd = 4) {
  if (!str) return str;
  const s = String(str);
  if (s.length <= keepEnd) return '*'.repeat(s.length);
  return '*'.repeat(s.length - keepEnd) + s.slice(-keepEnd);
}

function authHeaders() {
  ensureEnv();

  const basic = Buffer.from(`${appId}:${appKey}`).toString('base64');

  return {
    'Content-Type': 'application/json;charset=utf-8',

    // الشكل اللي انت حاطه
    'APP-ID': appId,
    'APP-KEY': appKey,

    // أشكال شائعة بالـ gateways
    'app-id': appId,
    'app-key': appKey,
    'app_id': appId,
    'app_key': appKey,
    'x-app-id': appId,
    'x-app-key': appKey,
    'X-APP-ID': appId,
    'X-APP-KEY': appKey,

    // كثير mocks بدها Basic
    'Authorization': `Basic ${basic}`,
  };
}

function authParams() {
  ensureEnv();
  // بعض الـ mock-service بدها auth كـ query params
  return {
    appId,
    appKey,
    app_id: appId,
    app_key: appKey,
    'APP-ID': appId,
    'APP-KEY': appKey,
  };
}

function mapStatus(s) {
  if (s === 'COMPLETED') return 'verified';
  if (s === 'REJECTED') return 'rejected';
  if (s === 'EXPIRED') return 'expired';
  return 'pending';
}

// --- Debug interceptor (مرة واحدة) ---
if (DEBUG) {
  axios.interceptors.request.use((config) => {
    console.log('NAFATH OUTGOING →', {
      method: config.method,
      url: config.url,
      params: { ...config.params, appKey: safeMask(config.params?.appKey) },
      headers: {
        'APP-ID': config.headers?.['APP-ID'] || config.headers?.['app-id'],
        'APP-KEY': (config.headers?.['APP-KEY'] || config.headers?.['app-key']) ? 'SET' : 'MISSING',
        'Authorization': config.headers?.Authorization ? 'SET' : 'MISSING',
      },
    });
    return config;
  });
}

async function startVerification({ nationalId, service, local = 'ar' }) {
  ensureEnv();
  const requestId = randomUUID();

  // ✅ جرّب مسارين (لأن بعضهم بده بدون /nafath)
  const candidates = [
    `${baseURL}/api/v1/mfa/request`,
    // لو الـ baseURL كان https://mock-service.api.elm.sa (بدون /nafath)
    `${baseURL}/nafath/api/v1/mfa/request`,
  ];

  const body = { nationalId, service };

  let lastErr;
  for (const url of candidates) {
    try {
      const res = await axios.post(url, body, {
        headers: authHeaders(),
        params: { local, requestId, ...authParams() },
        timeout: 15000,
      });

      const data = res.data || {};
      return {
        requestId,
        transId: data.transId,
        random: data.random,
        raw: data,
      };
    } catch (err) {
      lastErr = err;
      if (DEBUG) {
        console.error('NAFATH START FAIL →', {
          triedUrl: url,
          status: err.response?.status,
          data: err.response?.data,
          msg: err.message,
        });
      }
    }
  }

  throw lastErr;
}

async function getVerificationStatus({ nationalId, transId, random }) {
  ensureEnv();

  const candidates = [
    `${baseURL}/api/v1/mfa/request/status`,
    `${baseURL}/nafath/api/v1/mfa/request/status`,
  ];

  const body = { nationalId, transId, random };

  let lastErr;
  for (const url of candidates) {
    try {
      const res = await axios.post(url, body, {
        headers: authHeaders(),
        params: { ...authParams() },
        timeout: 15000,
      });

      const data = res.data || {};
      return {
        status: mapStatus(data.status),
        nafathStatus: data.status,
        raw: data,
      };
    } catch (err) {
      lastErr = err;
      if (DEBUG) {
        console.error('NAFATH STATUS FAIL →', {
          triedUrl: url,
          status: err.response?.status,
          data: err.response?.data,
          msg: err.message,
        });
      }
    }
  }

  throw lastErr;
}

module.exports = {
  startVerification,
  getVerificationStatus,
};
