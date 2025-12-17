import { request } from 'undici';
import { randomUUID } from 'node:crypto';

const BASE = 'https://mock-service.api.elm.sa/nafath'; // جرّبنا عليه
const local = 'ar';
const requestId = randomUUID();

const APP_ID = 'EkPmEzty';
const APP_KEY = 'a7af99c6e8f149f69d4a5af2f3a0f980';

const url = `${BASE}/api/v1/mfa/request?local=${encodeURIComponent(local)}&requestId=${encodeURIComponent(requestId)}`;

const payload = {
  nationalId: '1234567890',
  service: 'TIC',
};

const { statusCode, body, headers } = await request(url, {
  method: 'POST',
  headers: {
    // مثل الدوك تماماً
    'APP-ID': APP_ID,
    'APP-KEY': APP_KEY,
    'Content-Type': 'application/json;charset=utf-8',
    'Accept': 'application/json',

    // مثل الدوك (اختياري بس خلّينا نطابق 1:1)
    app_id: APP_ID,
    app_key: APP_KEY,
  },
  body: JSON.stringify(payload),
});

const text = await body.text();

console.log('URL:', url);
console.log('Status:', statusCode);
console.log('Resp headers:', headers);
console.log('Body:', text);
