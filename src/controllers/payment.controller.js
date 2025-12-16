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
      amount: halalas,
      currency: 'SAR',
      description: localPayment.description,
      publishableKey: process.env.MOYASAR_PUBLISHABLE_KEY,
      callbackUrl: `${process.env.FRONTEND_URL}/payment/callback?pid=${localPayment.id}`
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
    const event = req.body;

    // 1) تحقق من secret_token (هي “كلمة سر” بتحددها من داشبورد ميسّر)
    if (!event?.secret_token || event.secret_token !== process.env.MOYASAR_WEBHOOK_SECRET) {
      return res.sendStatus(401);
    }

    // 2) بيانات الدفع موجودة داخل event.data
    const payment = event.data;
    if (!payment?.id) return res.sendStatus(400);

    const status = payment.status; // paid / failed / initiated ... حسب ميسّر
    const feeHalalas = payment.fee || 0;

    await updatePaymentByGatewayId(payment.id, {
      status,
      gateway_fee_halalas: feeHalalas,
      meta: { event }, // خزّن الايفنت كله أو payment لحاله حسب ما بدك
    });

    // TODO: إذا status === 'paid' → فعّل الاشتراك/الباقة عندك (لازم يكون idempotent)
    return res.sendStatus(200);
  } catch (err) {
    console.error('moyasarWebhook error:', err);
    return res.sendStatus(500);
  }
};