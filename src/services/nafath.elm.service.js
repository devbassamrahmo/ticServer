// src/services/nafath.elm.service.js
const axios = require('axios');
const { randomUUID } = require('crypto');
const provider = (process.env.NAFATH_PROVIDER || 'elm').toLowerCase();

const baseURL = process.env.NAFATH_BASE_URL;
const appId = process.env.NAFATH_APP_ID;
const appKey = process.env.NAFATH_APP_KEY;

function headers() {
  return {
    'Content-Type': 'application/json;charset=utf-8',
    'Accept': 'application/json',

    // ⚠️ مهم جداً: نفس الاسم بالضبط
    'app_id': appId,
    'app_key': appKey,
  };
}

function mapStatus(s) {
  if (s === 'COMPLETED') return 'verified';
  if (s === 'REJECTED') return 'rejected';
  if (s === 'EXPIRED') return 'expired';
  return 'pending';
}

async function startVerification({ nationalId, service, local = 'ar' }) {
  const requestId = randomUUID();

  const res = await axios.post(
    `${baseURL}/api/v1/mfa/request`,
    { nationalId, service },
    {
      headers: headers(),
      params: { local, requestId },
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
  const res = await axios.post(
    `${baseURL}/api/v1/mfa/request/status`,
    { nationalId, transId, random },
    { headers: headers() }
  );

  return {
    status: mapStatus(res.data.status),
    nafathStatus: res.data.status,
    raw: res.data,
  };
}

module.exports = { startVerification, getVerificationStatus };
