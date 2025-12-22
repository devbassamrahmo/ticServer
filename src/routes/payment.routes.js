// src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authRequired } = require('../middleware/auth');

// إنشاء دفعة
router.post('/create', authRequired, express.json(), paymentController.createPayment);

// تحقق
router.get('/:id/verify', authRequired, paymentController.verifyPayment);

// Webhook (بدون auth)
router.post('/webhook/moyasar', express.json(), paymentController.moyasarWebhook);

module.exports = router;
