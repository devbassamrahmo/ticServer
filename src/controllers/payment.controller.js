// src/controllers/payment.controller.js
const axios = require('axios');
const {
  createPaymentRecord,
  attachGatewayInfo,
  updatePaymentByGatewayId,
  findPaymentById,
} = require('../models/payment.model');

const MOYASAR_API_URL = 'https://api.moyasar.com/v1';

function moyasarAuth() {
  if (!process.env.MOYASAR_SECRET_KEY) {
    throw new Error('MOYASAR_SECRET_KEY is missing');
  }
  return { username: process.env.MOYASAR_SECRET_KEY, password: '' };
}

/**
 * POST /api/payments/create
 * body: { amount, description?, meta?, source? }
 *
 * ملاحظة:
 * - أفضل نمط: الفرونت يجيب token (publishable key) وبعدين يبعت source={type:"token", token:"tok_..."}
 * - للتجربة السريعة فقط: ممكن تبعت source بطاقة مباشرة (مو مستحسن للإنتاج).
 */
exports.createPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, description, meta, source } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'amount مطلوب' });
    }

    // لازم source لأن Moyasar Create Payment بيعتمد عليه :contentReference[oaicite:2]{index=2}
    if (!source?.type) {
      return res.status(400).json({ success: false, message: 'source مطلوب (مثل token / creditcard / stcpay)' });
    }

    const halalas = Math.round(Number(amount) * 100);

    // 1) local record
    const localPayment = await createPaymentRecord({
      user_id: userId,
      amount_halalas: halalas,
      description: description || 'Site subscription',
      meta: meta || {},
    });

    const callbackUrl = `${process.env.FRONTEND_URL}/payment/callback?pid=${localPayment.id}`;

    // 2) create payment at Moyasar :contentReference[oaicite:3]{index=3}
    const payload = {
      amount: halalas,
      currency: 'SAR',
      description: localPayment.description,
      callback_url: callbackUrl,
      metadata: { localPaymentId: localPayment.id }, // metadata supported :contentReference[oaicite:4]{index=4}
      source,
    };

    const { data: gatewayPayment } = await axios.post(
      `${MOYASAR_API_URL}/payments`,
      payload,
      { auth: moyasarAuth() }
    );

    // 3) store gateway id
    await attachGatewayInfo(localPayment.id, { gateway_payment_id: gatewayPayment.id });

    // 4) return info for redirect if initiated
    return res.json({
      success: true,
      localPaymentId: localPayment.id,
      gatewayPaymentId: gatewayPayment.id,
      status: gatewayPayment.status, // initiated/paid/failed :contentReference[oaicite:5]{index=5}
      transactionUrl: gatewayPayment?.source?.transaction_url || null, // redirect if initiated :contentReference[oaicite:6]{index=6}
      callbackUrl,
    });
  } catch (err) {
    console.error('createPayment error:', err?.response?.data || err);
    return res.status(500).json({ success: false, message: 'فشل إنشاء عملية الدفع' });
  }
};

// POST /api/payments/webhook/moyasar
exports.moyasarWebhook = async (req, res) => {
  try {
    const event = req.body;

    // Moyasar webhook secured by secret_token :contentReference[oaicite:7]{index=7}
    if (!event?.secret_token || event.secret_token !== process.env.MOYASAR_WEBHOOK_SECRET) {
      return res.sendStatus(401);
    }

    // حسب الدوكس: payload يحتوي payment object (أحياناً ضمن data حسب الإعداد)
    const payment = event.data || event.payment || event;
    if (!payment?.id) return res.sendStatus(400);

    const status = payment.status; // initiated/paid/failed ... :contentReference[oaicite:8]{index=8}
    const feeHalalas = payment.fee || 0;

    // idempotent update
    const updated = await updatePaymentByGatewayId(payment.id, {
      status,
      gateway_fee_halalas: feeHalalas,
      meta: { webhook: event },
    });

    // إذا ما لقينا سجل محلي (نادر) لا تكسر webhook
    if (!updated) {
      console.warn('Webhook received but local payment not found for gateway id:', payment.id);
      return res.sendStatus(200);
    }

    // TODO: إذا status === 'paid' فعّل الاشتراك عندك (لازم تكون العملية idempotent)
    return res.sendStatus(200);
  } catch (err) {
    console.error('moyasarWebhook error:', err);
    return res.sendStatus(500);
  }
};

/**
 * GET /api/payments/:id/verify
 * بجيب الحالة من Moyasar مباشرة (مفيد بالتجربة أو كـ fallback لو webhook تأخر)
 */
exports.verifyPayment = async (req, res) => {
  try {
    const localId = req.params.id;
    const localPayment = await findPaymentById(localId);
    if (!localPayment) return res.status(404).json({ success: false, message: 'Payment not found' });

    if (!localPayment.gateway_payment_id) {
      return res.status(400).json({ success: false, message: 'No gateway_payment_id yet' });
    }

    const { data: gatewayPayment } = await axios.get(
      `${MOYASAR_API_URL}/payments/${localPayment.gateway_payment_id}`,
      { auth: moyasarAuth() }
    );

    // sync local status
    await updatePaymentByGatewayId(localPayment.gateway_payment_id, {
      status: gatewayPayment.status,
      gateway_fee_halalas: gatewayPayment.fee || 0,
      meta: { verify: gatewayPayment },
    });

    return res.json({
      success: true,
      localPaymentId: localPayment.id,
      gatewayPaymentId: localPayment.gateway_payment_id,
      status: gatewayPayment.status,
      transactionUrl: gatewayPayment?.source?.transaction_url || null,
    });
  } catch (err) {
    console.error('verifyPayment error:', err?.response?.data || err);
    return res.status(500).json({ success: false, message: 'Verify failed' });
  }
};
