// src/routes/site.routes.js
const express = require('express');
const router = express.Router();
const siteController = require('../controllers/site.controller');
const { authRequired } = require('../middleware/auth');

// ===== PUBLIC =====

// إعدادات الموقع
router.get('/public/:slug', siteController.getPublicSiteConfig);

// فحص الـ slug
router.get('/check-slug', siteController.checkSlug);

// عقارات (realestate) لموقع معيّن
router.get(
  '/public/:slug/listings/featured',
  siteController.getFeaturedRealestateForSite
);

router.get(
  '/public/:slug/listings/search',
  siteController.searchRealestateForSite
);

router.get(
  '/public/:slug/listings/:listingId',
  siteController.getRealestateDetailsForSite
);

// ===== PRIVATE (لوحة التحكم) =====
router.use(authRequired);

router.get('/', siteController.getMySite);     // ?sector=cars|realestate
router.post('/', siteController.upsertMySite);

router.patch('/basic', siteController.updateMySiteBasic);
router.patch('/theme', siteController.updateMySiteTheme);
router.patch('/settings', siteController.updateMySiteSettings);
router.patch('/publish', siteController.setPublishState);
router.put('/', siteController.updateMySiteAll);
module.exports = router;
