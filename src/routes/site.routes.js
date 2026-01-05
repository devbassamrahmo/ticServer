// src/routes/site.routes.js
const express = require('express');
const router = express.Router();
const siteController = require('../controllers/site.controller');
const { authRequired } = require('../middleware/auth');
const reportController = require('../controllers/report.controller');

// ===== PUBLIC =====
router.get('/public/:slug', siteController.getPublicSiteConfig);
router.get('/check-slug', siteController.checkSlug);

// Realestate public listings for a site
router.get('/public/:slug/listings/featured', siteController.getFeaturedRealestateForSite);
router.get('/public/:slug/listings/search', siteController.searchRealestateForSite);
router.get('/public/:slug/listings/:listingId', siteController.getRealestateDetailsForSite);
// router.get('/public/:slug/properties/:id', siteController.getPropertyDetailsForSite);
// router.get('/public/:slug/projects/:id', siteController.getProjectDetailsForSite);

// Cars public endpoints for a site
router.get('/public/:slug/cars/featured', siteController.getFeaturedCarsForPublicSite);
router.get('/public/:slug/cars', siteController.searchCarsForSite);
router.get('/public/:slug/cars/:carId', siteController.getCarDetailsForSite);

// Cars similar
router.get('/public/:slug/cars/:carId/similar', siteController.getSimilarCars);

// Listings similar (property/project)
router.get('/public/:slug/listings/:listingId/similar', siteController.getSimilarListings);

// report car
router.post('/public/:slug/cars/:carId/report', express.json(), reportController.reportCar);

// report listing (property/project)
router.post('/public/:slug/listings/:listingId/report', express.json(), reportController.reportListing);

// ===== PRIVATE =====
router.use(authRequired);

router.get('/', siteController.getMySite);                // ?sector=cars|realestate
router.post('/', siteController.upsertMySite);            // upsert full
router.post('/template', siteController.setTemplateStep);

router.patch('/basic', siteController.updateMySiteBasic);
router.patch('/theme', siteController.updateMySiteTheme);
router.patch('/settings', siteController.updateMySiteSettings);
router.patch('/publish', siteController.setPublishState);

router.put('/', siteController.updateMySiteAll);

module.exports = router;
