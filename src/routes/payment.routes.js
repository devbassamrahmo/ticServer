// src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authRequired } = require('../middleware/auth');

// إنشاء دفعة
router.post('/create', authRequired, express.json(), paymentController.createPayment);

// Webhook من ميسر (ما يحتاج auth من عندك)
router.post(
  '/webhook/moyasar',
  express.json(), // لازم RAW JSON
  paymentController.moyasarWebhook
);

module.exports = router;