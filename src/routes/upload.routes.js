// src/routes/upload.routes.js
const express = require('express');
const router = express.Router();

const { authRequired } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadController = require('../controllers/upload.controller');

// كل الرفع يحتاج يوزر مسجّل
router.use(authRequired);

// رفع صورة لإعلان (عقار أو سيارة)
router.post(
  '/listing-image',
  upload.single('file'),          // field name = "file"
  uploadController.uploadListingImage
);

// رفع صورة هوية بصرية للموقع (logo / header)
router.post(
  '/branding-image',
  upload.single('file'),
  uploadController.uploadBrandingImage
);

// رفع مستند (سجل تجاري / عنوان وطني / شهادة ضريبية)
router.post(
  '/document',
  upload.single('file'),
  uploadController.uploadDocument
);

module.exports = router;
