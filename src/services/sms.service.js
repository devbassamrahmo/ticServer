// src/services/sms.service.js
const axios = require('axios');

async function sendOtpSms(phone, code) {
  const apiUrl = process.env.MSEGAT_API_URL || 'https://www.msegat.com/gw/sendsms.php';

  const payload = new URLSearchParams({
    apiKey: process.env.MSEGAT_API_KEY,
    userName: process.env.MSEGAT_USER_NAME,
    userSender: process.env.MSEGAT_SENDER_NAME,
    numbers: phone,
    msg: `رمز التحقق الخاص بك في منصة Sitec هو: ${code}`, // عدل النص إذا حابب
  });

  try {
    const { data } = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });

    // هون فيك تطبع الرد مشان تشيك أول مرة:
    console.log('Msegat response:', data);

    // حسب الـ API تبعهم، عدل الشرط:
    // مثال: إذا في field اسمو code أو status
    return true;
  } catch (err) {
    console.error('Msegat SMS error:', err.response?.data || err.message);
    throw new Error('SMS_SEND_FAILED');
  }
}

module.exports = {
  sendOtpSms,
};
