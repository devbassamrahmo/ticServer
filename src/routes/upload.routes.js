// src/routes/upload.routes.js
const express = require('express');
const router = express.Router();

const { authRequired } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadController = require('../controllers/upload.controller');

router.use(authRequired);

// رفع صور/فيديوهات إعلان (حتى 10 ملفات)
router.post(
  '/listing-image',
  upload.any(),                        // 👈 مهم
  uploadController.uploadListingImage
);

// ✅ جلب صور/فيديوهات إعلان
router.get(
  '/listing-image',
  uploadController.getListingMedia
);

// رفع صور براندنغ (logo/header)
router.post(
  '/branding-image',
  upload.array('files', 5),
  uploadController.uploadBrandingImages
);

// ✅ جلب صور البراندنغ
router.get(
  '/branding-image',
  uploadController.getBrandingImages
);

// رفع مستندات
router.post(
  '/document',
  upload.array('files', 10),
  uploadController.uploadDocuments
);

// ✅ جلب مستندات اليوزر
router.get(
  '/document',
  uploadController.getMyDocuments
);

module.exports = router;