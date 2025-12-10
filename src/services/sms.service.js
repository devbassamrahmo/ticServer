// src/services/sms.service.js
const axios = require('axios');

const MSEGAT_API_URL = process.env.MSEGAT_API_URL;
const MSEGAT_API_KEY = process.env.MSEGAT_API_KEY;
const MSEGAT_USER_NAME = process.env.MSEGAT_USER_NAME;
const MSEGAT_SENDER_NAME = process.env.MSEGAT_SENDER_NAME;

// دالة عامة لإرسال أي SMS
async function sendSms({ to, message }) {
  if (!MSEGAT_API_URL || !MSEGAT_API_KEY) {
    console.warn('Msegat SMS disabled: missing API config');
    return { success: false, disabled: true };
  }

  try {
    // حسب توثيق Msegat، الموارد غالبًا من نوع form-data أو JSON
    // هون بنفترض شكل شائع، ولو عطاك صاحب السيرفر شكل مختلف نعدله بسهولة

    const payload = {
      apiKey: MSEGAT_API_KEY,
      userName: MSEGAT_USER_NAME,
      numbers: to,              // رقم أو أرقام مفصولة بفاصلة
      userSender: MSEGAT_SENDER_NAME,
      msg: message,
    };

    const response = await axios.post(MSEGAT_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // فيك تطبع الرد للتأكد
    console.log('Msegat response:', response.data);

    // هون رجع whatever بدك للـ callers
    return {
      success: true,
      providerResponse: response.data,
    };
  } catch (err) {
    console.error('Msegat SMS error:', err?.response?.data || err.message);
    return {
      success: false,
      error: err?.response?.data || err.message,
    };
  }
}

// دالة مخصصة لإرسال كود OTP
async function sendOtpSms(phone, code) {
  const msg = `رمز التحقق للدخول إلى Sitec هو: ${code}`;

  return await sendSms({
    to: phone,
    message: msg,
  });
}

module.exports = {
  sendSms,
  sendOtpSms,
};
