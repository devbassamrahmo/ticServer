// src/routes/reports.routes.js
const express = require('express');
const router = express.Router();
const c = require('../../controllers/public/reports.public.controller');

// Base: /api/site/public/:slug
router.post('/site/public/:slug/cars/:carId/report', c.reportCar);
router.post('/site/public/:slug/listings/:listingId/report', c.reportListing);

module.exports = router;
