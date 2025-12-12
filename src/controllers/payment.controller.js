// src/controllers/payment.controller.js
const axios = require('axios');
const {
  createPaymentRecord,
  attachGatewayInfo,
  updatePaymentByGatewayId,
} = require('../models/payment.model');

const MOYASAR_API_URL = 'https://api.moyasar.com/v1';

function moyasarAuth() {
  return {
    username: process.env.MOYASAR_SECRET_KEY,
    password: '',
  };
}

// 1) إنشاء دفعة جديدة
// POST /api/payments/create
// body: { amount, description, meta }
exports.createPayment = async (req, res) => {
  try {
    const userId = req.user.id; // من auth middleware
    const { amount, description, meta } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        message: 'amount مطلوب (ريال سعودي)',
      });
    }

    const halalas = Math.round(Number(amount) * 100);

    // سجل محلّي في جدول payments
    const localPayment = await createPaymentRecord({
      user_id: userId,
      amount_halalas: halalas,
      description: description || 'Site subscription',
      meta: meta || {},
    });

    // نستخدم ميسر لإنشاء payment "مبدئي"
    const response = await axios.post(
      `${MOYASAR_API_URL}/payments`,
      {
        amount: halalas,
        currency: 'SAR',
        description: description || 'Site subscription',
        // مبدئياً نستخدم stcpay أو creditcard حسب ما تخطط
        // لكن الأفضل تستخدم الـ "Hosted payment page" تبعهم
        source: {
          type: 'stcpay', // ممكن تغيّرها لاحقاً
          mobile: '500000000', // في الوضع الفعلي تاخدها من المستخدم
        },
        callback_url: 'https://your-site.com/payment/callback',
      },
      { auth: moyasarAuth() }
    );

    const gatewayPayment = response.data;

    // نربط ال payment المحلي بميسر
    await attachGatewayInfo(localPayment.id, {
      gateway_payment_id: gatewayPayment.id,
    });

    return res.json({
      success: true,
      localPaymentId: localPayment.id,
      moyasarPayment: gatewayPayment,
    });
  } catch (err) {
    console.error('createPayment error:', err.response?.data || err);
    return res.status(500).json({
      success: false,
      message: 'فشل إنشاء عملية الدفع',
    });
  }
};

// 2) Webhook من ميسر لتحديث حالة الدفع
// ميسر ترسل Payment object كامل
exports.moyasarWebhook = async (req, res) => {
  try {
    const payment = req.body;

    // تقدر تضيف هنا تحقق توقيع لو ميسر بتدعم Signature
    const status = payment.status; // paid, failed, etc.
    const feeHalalas = payment.fee || 0;

    const updated = await updatePaymentByGatewayId(payment.id, {
      status,
      gateway_fee_halalas: feeHalalas,
      meta: payment, // لو حاب تخزن كل الرد
    });

    console.log('Moyasar webhook payment:', payment.id, status);

    // TODO: لو status === 'paid' فعّل الاشتراك / الباقة عندك

    return res.sendStatus(200);
  } catch (err) {
    console.error('moyasarWebhook error:', err);
    return res.sendStatus(500);
  }
};
