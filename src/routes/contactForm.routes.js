// src/routes/contactForm.routes.js
const express = require('express');
const router = express.Router();
const contactFormController = require('../controllers/contactForm.controller');
const { authRequired } = require('../middleware/auth');

// إرسال الفورم (عام، بدون تسجيل دخول)
router.post('/', express.json(), contactFormController.submitContactForm);

// جلب كل الفورمات (محمي – للداشبورد)
router.get('/', authRequired, contactFormController.listContactForms);

// جلب فورم واحد حسب id (محمي)
router.get('/:id', authRequired, contactFormController.getContactForm);

module.exports = router;
